from datetime import date, datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class QuestType(str, Enum):
    streak = "streak"
    counter = "counter"
    boss_battle = "boss_battle"
    milestone = "milestone"
    weekly_quota = "weekly_quota"


class QuestStatus(str, Enum):
    active = "active"
    completed = "completed"
    failed = "failed"
    paused = "paused"


class FailureMode(str, Enum):
    hard_reset = "hard_reset"
    freeze_lives = "freeze_lives"


# ── DB Tables ──────────────────────────────────────────────────────────────────

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Quest(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    title: str
    emoji: str
    description: Optional[str] = None
    type: QuestType
    status: QuestStatus = QuestStatus.active
    failure_mode: Optional[FailureMode] = None
    # Freeze lives fields
    lives_max: Optional[int] = None
    lives_remaining: Optional[int] = None
    lives_regen_days: Optional[int] = None
    # Counter quest fields
    daily_target: Optional[float] = None
    unit: Optional[str] = None
    # Boss battle / milestone fields
    numeric_target: Optional[float] = None
    numeric_current: Optional[float] = None
    deadline: Optional[date] = None
    # Weekly quota fields
    weekly_target: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class CheckIn(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    quest_id: int = Field(foreign_key="quest.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    logged_at: date
    value: Optional[float] = None       # for counter quests
    success: bool
    notes: Optional[str] = None
    life_used: bool = False             # life consumed to cover this failure


class Badge(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    badge_key: str
    earned_at: datetime = Field(default_factory=datetime.utcnow)


# ── API Schemas ────────────────────────────────────────────────────────────────

class UserCreate(SQLModel):
    username: str
    password: str


class TokenResponse(SQLModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(SQLModel):
    id: int
    username: str
    created_at: datetime


class QuestCreate(SQLModel):
    title: str
    emoji: str
    description: Optional[str] = None
    type: QuestType
    failure_mode: Optional[FailureMode] = None
    lives_max: Optional[int] = None
    lives_regen_days: Optional[int] = 7
    daily_target: Optional[float] = None
    unit: Optional[str] = None
    numeric_target: Optional[float] = None
    numeric_current: Optional[float] = None
    deadline: Optional[date] = None
    weekly_target: Optional[int] = None


class QuestUpdate(SQLModel):
    title: Optional[str] = None
    emoji: Optional[str] = None
    description: Optional[str] = None
    failure_mode: Optional[FailureMode] = None
    lives_max: Optional[int] = None
    lives_regen_days: Optional[int] = None
    daily_target: Optional[float] = None
    unit: Optional[str] = None
    numeric_target: Optional[float] = None
    deadline: Optional[date] = None
    weekly_target: Optional[int] = None


class CheckInCreate(SQLModel):
    success: Optional[bool] = None      # for streak quests
    value: Optional[float] = None       # for counter quests
    notes: Optional[str] = None


class NumericUpdate(SQLModel):
    value: float
    notes: Optional[str] = None


class QuestResponse(SQLModel):
    id: int
    user_id: int
    title: str
    emoji: str
    description: Optional[str]
    type: QuestType
    status: QuestStatus
    failure_mode: Optional[FailureMode]
    lives_max: Optional[int]
    lives_remaining: Optional[int]
    lives_regen_days: Optional[int]
    daily_target: Optional[float]
    unit: Optional[str]
    numeric_target: Optional[float]
    numeric_current: Optional[float]
    deadline: Optional[date]
    weekly_target: Optional[int]
    created_at: datetime
    completed_at: Optional[datetime]
    # Computed
    current_streak: int = 0
    best_streak: int = 0
    current_week_count: int = 0
    today_checked: bool = False
    new_badges: list[str] = []


class CheckInResponse(SQLModel):
    id: int
    quest_id: int
    logged_at: date
    value: Optional[float]
    success: bool
    notes: Optional[str]
    life_used: bool


class QuestDetailResponse(QuestResponse):
    checkins: list[CheckInResponse] = []


class BadgeResponse(SQLModel):
    badge_key: str
    earned_at: datetime


class StatsResponse(SQLModel):
    total_quests: int
    active_quests: int
    completed_quests: int
    best_streak_ever: int
    combo_count: int
    badges_earned: int
