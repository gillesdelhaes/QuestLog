"""
Combo system.

The combo is the count of the user's active quests that currently have an
unbroken streak (streak > 0). For boss_battle and milestone quests, they
count toward the combo as long as their status is active.

A hard-reset failure on any quest reduces the combo by dropping that quest's
streak to 0.
"""

from sqlmodel import Session, select

from ..models import CheckIn, Quest, QuestStatus, QuestType
from .streak import get_streak_and_best


def calculate_combo(user_id: int, session: Session) -> int:
    quests = session.exec(
        select(Quest).where(Quest.user_id == user_id, Quest.status == QuestStatus.active)
    ).all()

    if not quests:
        return 0

    combo = 0
    for quest in quests:
        if quest.type in (QuestType.boss_battle, QuestType.milestone):
            combo += 1
            continue

        checkins = session.exec(
            select(CheckIn).where(CheckIn.quest_id == quest.id)
        ).all()
        current_streak, _ = get_streak_and_best(quest, checkins)
        if current_streak > 0:
            combo += 1

    return combo
