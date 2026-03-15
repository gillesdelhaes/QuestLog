"""
Streak calculation logic.

Rules:
- Streak is always calculated from CheckIn records, never stored.
- For streak/counter quests: one check-in per calendar day.
- For weekly_quota quests: multiple check-ins per day allowed (each = one occurrence).
- Missed days are detected lazily on check-in and quest fetch.
- Hard Reset: any failure day breaks the streak to 0 immediately.
- Freeze Lives: a failure day consumes one life (life_used=True on the record).
  The streak continues as long as lives were available to cover the failure.
  Life regen: every `lives_regen_days` consecutive pure-success days earns 1 life back.
- Rolling 7-day windows anchored to quest creation date for Weekly Quota.
"""

from datetime import date, timedelta
from typing import Optional

from ..models import CheckIn, FailureMode, Quest, QuestStatus, QuestType


# ── Streak calculation ─────────────────────────────────────────────────────────

def get_streak_and_best(quest: Quest, checkins: list[CheckIn]) -> tuple[int, int]:
    """Return (current_streak, best_streak) for streak/counter quests."""
    if quest.type == QuestType.weekly_quota:
        current = get_weekly_quota_streak(quest, checkins)
        return current, current  # best_streak not tracked separately for weekly_quota

    if not checkins:
        return 0, 0

    by_date: dict[date, CheckIn] = {c.logged_at: c for c in checkins}
    sorted_dates = sorted(by_date.keys())

    # Calculate best streak by scanning all records
    best = 0
    run = 0
    for d in sorted_dates:
        c = by_date[d]
        if c.success or c.life_used:
            run += 1
            best = max(best, run)
        else:
            run = 0

    # Calculate current streak going backward from today/yesterday
    today = date.today()
    current = 0
    # Start from today if checked in, otherwise yesterday
    start = today if today in by_date else today - timedelta(days=1)

    expected = start
    while True:
        if expected not in by_date:
            break
        c = by_date[expected]
        if c.success or c.life_used:
            current += 1
            expected -= timedelta(days=1)
        else:
            break

    return current, best


def get_weekly_quota_streak(quest: Quest, checkins: list[CheckIn]) -> int:
    """Return streak of successful rolling 7-day periods."""
    if not quest.weekly_target:
        return 0

    origin = quest.created_at.date()
    # If the user backfilled entries before the quest creation date, anchor to the earliest entry
    if checkins:
        earliest = min(c.logged_at for c in checkins)
        if earliest < origin:
            origin = earliest
    today = date.today()
    days_elapsed = (today - origin).days
    completed_periods = days_elapsed // 7

    if completed_periods == 0:
        return 0

    streak = 0
    for period in range(completed_periods - 1, -1, -1):
        period_start = origin + timedelta(days=period * 7)
        period_end = origin + timedelta(days=period * 7 + 6)
        count = sum(1 for c in checkins if period_start <= c.logged_at <= period_end)
        if count >= quest.weekly_target:
            streak += 1
        else:
            break

    return streak


def get_current_week_count(quest: Quest, checkins: list[CheckIn]) -> int:
    """Count check-ins in the last 7 calendar days (rolling window from today)."""
    if quest.type != QuestType.weekly_quota:
        return 0

    today = date.today()
    week_start = today - timedelta(days=6)
    return sum(1 for c in checkins if week_start <= c.logged_at <= today)


def is_today_checked(checkins: list[CheckIn]) -> bool:
    today = date.today()
    return any(c.logged_at == today for c in checkins)


# ── Missed-day gap processing ─────────────────────────────────────────────────

def process_missed_days(quest: Quest, checkins: list[CheckIn], session) -> list[CheckIn]:
    """
    Detect days missed since the last check-in and create failure records.
    Applies lives deduction for freeze_lives quests.
    Returns list of newly created CheckIn records.
    """
    from ..models import CheckIn as CheckInModel

    if quest.type in (QuestType.boss_battle, QuestType.milestone, QuestType.weekly_quota):
        return []
    if quest.status in (QuestStatus.completed, QuestStatus.failed, QuestStatus.paused):
        return []

    today = date.today()
    by_date = {c.logged_at: c for c in checkins}

    if not by_date:
        # New quest — no gap to process
        return []

    last_date = max(by_date.keys())
    if last_date >= today:
        return []

    new_records: list[CheckIn] = []
    current_date = last_date + timedelta(days=1)

    while current_date < today:
        if current_date not in by_date:
            life_used = False
            if quest.failure_mode == FailureMode.freeze_lives and (quest.lives_remaining or 0) > 0:
                quest.lives_remaining -= 1
                life_used = True

            record = CheckInModel(
                quest_id=quest.id,
                user_id=quest.user_id,
                logged_at=current_date,
                success=False,
                life_used=life_used,
            )
            session.add(record)
            new_records.append(record)
        current_date += timedelta(days=1)

    if new_records:
        session.add(quest)
        session.commit()
        for r in new_records:
            session.refresh(r)

    return new_records


# ── Life regeneration ─────────────────────────────────────────────────────────

def apply_life_regen(quest: Quest, checkins: list[CheckIn], session) -> bool:
    """
    After a successful check-in, recalculate lives based on consecutive pure-success streak.
    Every `lives_regen_days` consecutive pure-success days earns back 1 life (up to lives_max).
    Returns True if lives were modified.
    """
    if quest.failure_mode != FailureMode.freeze_lives:
        return False
    if quest.lives_remaining is None or quest.lives_max is None or quest.lives_regen_days is None:
        return False
    if quest.lives_remaining >= quest.lives_max:
        return False

    # Count consecutive pure-success days ending today
    today = date.today()
    by_date = {c.logged_at: c for c in checkins}
    pure_streak = 0
    check_date = today
    while check_date in by_date:
        c = by_date[check_date]
        if c.success and not c.life_used:
            pure_streak += 1
            check_date -= timedelta(days=1)
        else:
            break

    regen_count = pure_streak // quest.lives_regen_days
    new_lives = min(quest.lives_max, quest.lives_remaining + regen_count)

    if new_lives != quest.lives_remaining:
        quest.lives_remaining = new_lives
        session.add(quest)
        session.commit()
        return True

    return False
