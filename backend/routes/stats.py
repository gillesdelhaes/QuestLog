from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import Badge, CheckIn, Quest, QuestStatus, QuestType, StatsResponse, User
from ..services.combo import calculate_combo
from ..services.streak import get_streak_and_best

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=StatsResponse)
def get_stats(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    quests = session.exec(select(Quest).where(Quest.user_id == current_user.id)).all()
    badges = session.exec(select(Badge).where(Badge.user_id == current_user.id)).all()

    best_streak_ever = 0
    for quest in quests:
        if quest.type in (QuestType.boss_battle, QuestType.milestone):
            continue
        checkins = list(session.exec(select(CheckIn).where(CheckIn.quest_id == quest.id)).all())
        _, best = get_streak_and_best(quest, checkins)
        if best > best_streak_ever:
            best_streak_ever = best

    return StatsResponse(
        total_quests=len(quests),
        active_quests=sum(1 for q in quests if q.status == QuestStatus.active),
        completed_quests=sum(1 for q in quests if q.status == QuestStatus.completed),
        best_streak_ever=best_streak_ever,
        combo_count=calculate_combo(current_user.id, session),
        badges_earned=len(badges),
    )
