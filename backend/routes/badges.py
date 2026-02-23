from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import Badge, User
from ..services.badge_engine import BADGE_DEFINITIONS, get_badge_meta

router = APIRouter(prefix="/api/badges", tags=["badges"])


@router.get("")
def get_badges(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    earned = session.exec(select(Badge).where(Badge.user_id == current_user.id)).all()
    earned_keys = {b.badge_key for b in earned}

    earned_list = []
    for b in earned:
        meta = get_badge_meta(b.badge_key)
        earned_list.append({
            "badge_key": b.badge_key,
            "emoji": meta["emoji"],
            "label": meta["label"],
            "description": meta["description"],
            "earned_at": b.earned_at.isoformat(),
        })

    locked_list = []
    for badge_def in BADGE_DEFINITIONS:
        if badge_def["key"] not in earned_keys:
            locked_list.append({
                "badge_key": badge_def["key"],
                "emoji": badge_def["emoji"],
                "label": badge_def["label"],
                "description": badge_def["description"],
            })

    return {"earned": earned_list, "locked": locked_list}
