from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import (
    CheckIn,
    CheckInCreate,
    CheckInResponse,
    FailureMode,
    NumericUpdate,
    Quest,
    QuestCreate,
    QuestDetailResponse,
    QuestResponse,
    QuestStatus,
    QuestType,
    QuestUpdate,
    User,
)
from ..services.badge_engine import run_badge_engine
from ..services.streak import (
    apply_life_regen,
    get_current_week_count,
    get_streak_and_best,
    is_today_checked,
    process_missed_days,
)

router = APIRouter(prefix="/api/quests", tags=["quests"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _check_boss_deadline(quest: Quest, session: Session) -> Quest:
    """Lazily mark a boss_battle quest as completed or failed if deadline passed."""
    if (
        quest.type == QuestType.boss_battle
        and quest.status == QuestStatus.active
        and quest.deadline
        and date.today() > quest.deadline
    ):
        if (quest.numeric_current or 0) >= (quest.numeric_target or 0):
            quest.status = QuestStatus.completed
            quest.completed_at = datetime.utcnow()
        else:
            quest.status = QuestStatus.failed
        session.add(quest)
        session.commit()
    return quest


def _build_response(quest: Quest, checkins: list[CheckIn], new_badges: list[str] = None) -> QuestResponse:
    current_streak, best_streak = get_streak_and_best(quest, checkins)
    return QuestResponse(
        **quest.model_dump(),
        current_streak=current_streak,
        best_streak=best_streak,
        current_week_count=get_current_week_count(quest, checkins),
        today_checked=is_today_checked(checkins),
        new_badges=new_badges or [],
    )


def _get_quest_or_404(quest_id: int, user_id: int, session: Session) -> Quest:
    quest = session.get(Quest, quest_id)
    if not quest or quest.user_id != user_id:
        raise HTTPException(status_code=404, detail="Quest not found")
    return quest


def _get_checkins(quest_id: int, session: Session) -> list[CheckIn]:
    return list(session.exec(select(CheckIn).where(CheckIn.quest_id == quest_id)).all())


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[QuestResponse])
def list_quests(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    quests = session.exec(select(Quest).where(Quest.user_id == current_user.id)).all()
    results = []
    for quest in quests:
        quest = _check_boss_deadline(quest, session)
        checkins = _get_checkins(quest.id, session)
        process_missed_days(quest, checkins, session)
        checkins = _get_checkins(quest.id, session)  # refresh after gap-fill
        results.append(_build_response(quest, checkins))
    return results


@router.post("", response_model=QuestResponse, status_code=201)
def create_quest(
    body: QuestCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Validate required fields per type
    if body.type == QuestType.counter and body.daily_target is None:
        raise HTTPException(status_code=400, detail="Counter quests require daily_target")
    if body.type == QuestType.weekly_quota and body.weekly_target is None:
        raise HTTPException(status_code=400, detail="Weekly quota quests require weekly_target")
    if body.type == QuestType.boss_battle:
        if body.numeric_target is None:
            raise HTTPException(status_code=400, detail="Boss battle quests require numeric_target")
        if body.deadline is None:
            raise HTTPException(status_code=400, detail="Boss battle quests require a deadline")
    if body.type == QuestType.milestone and body.numeric_target is None:
        raise HTTPException(status_code=400, detail="Milestone quests require numeric_target")

    quest = Quest(
        user_id=current_user.id,
        title=body.title,
        emoji=body.emoji,
        description=body.description,
        type=body.type,
        failure_mode=body.failure_mode,
        lives_max=body.lives_max if body.failure_mode == FailureMode.freeze_lives else None,
        lives_remaining=body.lives_max if body.failure_mode == FailureMode.freeze_lives else None,
        lives_regen_days=body.lives_regen_days if body.failure_mode == FailureMode.freeze_lives else None,
        daily_target=body.daily_target,
        unit=body.unit,
        numeric_target=body.numeric_target,
        numeric_current=body.numeric_current or 0.0,
        deadline=body.deadline,
        weekly_target=body.weekly_target,
    )
    session.add(quest)
    session.commit()
    session.refresh(quest)

    run_badge_engine(current_user.id, session)
    return _build_response(quest, [])


@router.get("/{quest_id}", response_model=QuestDetailResponse)
def get_quest(
    quest_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    quest = _get_quest_or_404(quest_id, current_user.id, session)
    quest = _check_boss_deadline(quest, session)
    checkins = _get_checkins(quest_id, session)
    process_missed_days(quest, checkins, session)
    checkins = _get_checkins(quest_id, session)

    base = _build_response(quest, checkins)
    checkin_responses = [
        CheckInResponse(
            id=c.id,
            quest_id=c.quest_id,
            logged_at=c.logged_at,
            value=c.value,
            success=c.success,
            notes=c.notes,
            life_used=c.life_used,
        )
        for c in sorted(checkins, key=lambda c: c.logged_at, reverse=True)
    ]
    return QuestDetailResponse(**base.model_dump(), checkins=checkin_responses)


@router.put("/{quest_id}", response_model=QuestResponse)
def update_quest(
    quest_id: int,
    body: QuestUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    quest = _get_quest_or_404(quest_id, current_user.id, session)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(quest, field, value)

    session.add(quest)
    session.commit()
    session.refresh(quest)

    checkins = _get_checkins(quest_id, session)
    return _build_response(quest, checkins)


@router.delete("/{quest_id}", status_code=204)
def delete_quest(
    quest_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    quest = _get_quest_or_404(quest_id, current_user.id, session)
    checkins = _get_checkins(quest_id, session)
    for c in checkins:
        session.delete(c)
    session.delete(quest)
    session.commit()


@router.post("/{quest_id}/checkin", response_model=QuestResponse)
def checkin(
    quest_id: int,
    body: CheckInCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    quest = _get_quest_or_404(quest_id, current_user.id, session)

    if quest.status == QuestStatus.paused:
        raise HTTPException(status_code=400, detail="Quest is paused")
    if quest.status in (QuestStatus.completed, QuestStatus.failed):
        raise HTTPException(status_code=400, detail="Quest is already finished")
    if quest.type in (QuestType.boss_battle, QuestType.milestone):
        raise HTTPException(status_code=400, detail="Use the /update endpoint for this quest type")

    today = date.today()
    checkins = _get_checkins(quest_id, session)

    # Process missed days before handling today
    process_missed_days(quest, checkins, session)
    checkins = _get_checkins(quest_id, session)

    # For streak/counter: one check-in per day
    if quest.type != QuestType.weekly_quota:
        if any(c.logged_at == today for c in checkins):
            raise HTTPException(status_code=409, detail="Already checked in today")

    # Determine success
    if quest.type == QuestType.streak:
        if body.success is None:
            raise HTTPException(status_code=400, detail="success field required for streak quests")
        success = body.success
        value = None
    elif quest.type == QuestType.counter:
        if body.value is None:
            raise HTTPException(status_code=400, detail="value field required for counter quests")
        value = body.value
        success = value >= (quest.daily_target or 0)
    else:  # weekly_quota — each POST is one occurrence
        success = True
        value = None

    life_used = False
    if not success and quest.failure_mode == FailureMode.freeze_lives:
        if (quest.lives_remaining or 0) > 0:
            quest.lives_remaining -= 1
            life_used = True
            session.add(quest)
            session.commit()

    record = CheckIn(
        quest_id=quest_id,
        user_id=current_user.id,
        logged_at=today,
        value=value,
        success=success,
        notes=body.notes,
        life_used=life_used,
    )
    session.add(record)
    session.commit()
    session.refresh(record)

    checkins = _get_checkins(quest_id, session)

    if success:
        apply_life_regen(quest, checkins, session)
        checkins = _get_checkins(quest_id, session)

    new_badges = run_badge_engine(current_user.id, session)
    session.refresh(quest)
    return _build_response(quest, checkins, new_badges)


@router.post("/{quest_id}/update", response_model=QuestResponse)
def update_numeric(
    quest_id: int,
    body: NumericUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    quest = _get_quest_or_404(quest_id, current_user.id, session)

    if quest.type not in (QuestType.boss_battle, QuestType.milestone):
        raise HTTPException(status_code=400, detail="This endpoint is for boss battle and milestone quests")
    if quest.status in (QuestStatus.completed, QuestStatus.failed):
        raise HTTPException(status_code=400, detail="Quest is already finished")
    if quest.status == QuestStatus.paused:
        raise HTTPException(status_code=400, detail="Quest is paused")

    quest.numeric_current = body.value
    session.add(quest)
    session.commit()

    # Auto-complete milestone when target reached
    if quest.type == QuestType.milestone and (quest.numeric_current or 0) >= (quest.numeric_target or 0):
        quest.status = QuestStatus.completed
        quest.completed_at = datetime.utcnow()
        session.add(quest)
        session.commit()

    # Lazy check on boss battle too
    quest = _check_boss_deadline(quest, session)

    run_badge_engine(current_user.id, session)
    session.refresh(quest)
    return _build_response(quest, [])


@router.post("/{quest_id}/pause", response_model=QuestResponse)
def pause_quest(
    quest_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    quest = _get_quest_or_404(quest_id, current_user.id, session)
    if quest.status != QuestStatus.active:
        raise HTTPException(status_code=400, detail="Only active quests can be paused")

    quest.status = QuestStatus.paused
    session.add(quest)
    session.commit()
    session.refresh(quest)

    checkins = _get_checkins(quest_id, session)
    return _build_response(quest, checkins)


@router.post("/{quest_id}/resume", response_model=QuestResponse)
def resume_quest(
    quest_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    quest = _get_quest_or_404(quest_id, current_user.id, session)
    if quest.status != QuestStatus.paused:
        raise HTTPException(status_code=400, detail="Quest is not paused")

    quest.status = QuestStatus.active
    session.add(quest)
    session.commit()
    session.refresh(quest)

    checkins = _get_checkins(quest_id, session)
    return _build_response(quest, checkins)


@router.post("/{quest_id}/complete", response_model=QuestResponse)
def complete_quest(
    quest_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    quest = _get_quest_or_404(quest_id, current_user.id, session)
    if quest.status in (QuestStatus.completed, QuestStatus.failed):
        raise HTTPException(status_code=400, detail="Quest is already finished")

    quest.status = QuestStatus.completed
    quest.completed_at = datetime.utcnow()
    session.add(quest)
    session.commit()
    session.refresh(quest)

    new_badges = run_badge_engine(current_user.id, session)
    checkins = _get_checkins(quest_id, session)
    return _build_response(quest, checkins, new_badges)
