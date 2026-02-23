"""
Badge engine — runs after every check-in and quest completion.

Checks all badge definitions against the user's current state and awards
any newly unlocked badges. Runs synchronously, no background tasks needed.
"""

from datetime import datetime

from sqlmodel import Session, select

from ..models import Badge, CheckIn, Quest, QuestStatus, QuestType
from .streak import get_streak_and_best, get_weekly_quota_streak

BADGE_DEFINITIONS: list[dict] = [
    {
        "key": "seedling",
        "emoji": "🌱",
        "label": "Seedling",
        "description": "Create your first quest",
    },
    {
        "key": "first_flame",
        "emoji": "🔥",
        "label": "First Flame",
        "description": "Complete your first 7-day streak",
    },
    {
        "key": "ironclad",
        "emoji": "💀",
        "label": "Ironclad",
        "description": "Complete a 30-day streak on a Hard Reset quest",
    },
    {
        "key": "chain_lightning",
        "emoji": "⚡",
        "label": "Chain Lightning",
        "description": "Have 3+ quests with active 7-day streaks simultaneously",
    },
    {
        "key": "boss_slayer",
        "emoji": "🏆",
        "label": "Boss Slayer",
        "description": "Complete a Boss Battle quest",
    },
    {
        "key": "hydrated_hero",
        "emoji": "💧",
        "label": "Hydrated Hero",
        "description": "14-day streak on a Counter quest",
    },
    {
        "key": "veteran",
        "emoji": "🗡️",
        "label": "Veteran",
        "description": "Complete 5 quests total",
    },
    {
        "key": "legendary",
        "emoji": "👑",
        "label": "Legendary",
        "description": "Complete a 100-day streak on any quest",
    },
    {
        "key": "weekly_warrior",
        "emoji": "📅",
        "label": "Weekly Warrior",
        "description": "Complete 4 consecutive successful weeks on a Weekly Quota quest",
    },
    {
        "key": "untouchable",
        "emoji": "🛡️",
        "label": "Untouchable",
        "description": "Keep 5+ quests in your combo simultaneously",
    },
]

BADGE_MAP = {b["key"]: b for b in BADGE_DEFINITIONS}


def get_badge_meta(key: str) -> dict:
    return BADGE_MAP.get(key, {"key": key, "emoji": "🏅", "label": key, "description": ""})


def _already_earned(user_id: int, badge_key: str, session: Session) -> bool:
    existing = session.exec(
        select(Badge).where(Badge.user_id == user_id, Badge.badge_key == badge_key)
    ).first()
    return existing is not None


def _award(user_id: int, badge_key: str, session: Session, new_badges: list):
    if not _already_earned(user_id, badge_key, session):
        session.add(Badge(user_id=user_id, badge_key=badge_key, earned_at=datetime.utcnow()))
        session.commit()
        new_badges.append(badge_key)


def run_badge_engine(user_id: int, session: Session) -> list[str]:
    """Returns list of badge_keys newly earned in this run."""
    new_badges: list[str] = []

    quests = session.exec(select(Quest).where(Quest.user_id == user_id)).all()
    all_checkins: dict[int, list[CheckIn]] = {}
    for q in quests:
        all_checkins[q.id] = session.exec(
            select(CheckIn).where(CheckIn.quest_id == q.id)
        ).all()

    completed_quests = [q for q in quests if q.status == QuestStatus.completed]

    # 🌱 Seedling — create your first quest
    if quests:
        _award(user_id, "seedling", session, new_badges)

    # Compute streaks for all quests
    streaks: dict[int, int] = {}
    for q in quests:
        if q.type not in (QuestType.boss_battle, QuestType.milestone):
            current, _ = get_streak_and_best(q, all_checkins.get(q.id, []))
            streaks[q.id] = current

    # 🔥 First Flame — first 7-day streak
    if any(s >= 7 for s in streaks.values()):
        _award(user_id, "first_flame", session, new_badges)

    # 💀 Ironclad — 30-day streak on a Hard Reset quest
    from ..models import FailureMode
    for q in quests:
        if q.failure_mode == FailureMode.hard_reset and streaks.get(q.id, 0) >= 30:
            _award(user_id, "ironclad", session, new_badges)
            break

    # ⚡ Chain Lightning — 3+ quests with active 7-day streaks simultaneously
    quests_with_7day = sum(1 for q in quests if streaks.get(q.id, 0) >= 7)
    if quests_with_7day >= 3:
        _award(user_id, "chain_lightning", session, new_badges)

    # 🏆 Boss Slayer — complete a Boss Battle quest
    if any(q.type == QuestType.boss_battle and q.status == QuestStatus.completed for q in quests):
        _award(user_id, "boss_slayer", session, new_badges)

    # 💧 Hydrated Hero — 14-day streak on a Counter quest
    for q in quests:
        if q.type == QuestType.counter and streaks.get(q.id, 0) >= 14:
            _award(user_id, "hydrated_hero", session, new_badges)
            break

    # 🗡️ Veteran — complete 5 quests total
    if len(completed_quests) >= 5:
        _award(user_id, "veteran", session, new_badges)

    # 👑 Legendary — 100-day streak on any quest
    if any(s >= 100 for s in streaks.values()):
        _award(user_id, "legendary", session, new_badges)

    # 📅 Weekly Warrior — 4 consecutive successful weeks on Weekly Quota
    for q in quests:
        if q.type == QuestType.weekly_quota:
            ws = get_weekly_quota_streak(q, all_checkins.get(q.id, []))
            if ws >= 4:
                _award(user_id, "weekly_warrior", session, new_badges)
                break

    # 🛡️ Untouchable — 5+ quests in combo
    from .combo import calculate_combo
    if calculate_combo(user_id, session) >= 5:
        _award(user_id, "untouchable", session, new_badges)

    return new_badges
