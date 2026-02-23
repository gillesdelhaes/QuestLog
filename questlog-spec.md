# QuestLog — Technical Specification

## Overview

QuestLog is a self-hosted personal goal tracking application built with a gamified RPG experience at its core. Users set personal quests (goals) and track their progress through streaks, combos, and achievement badges. The interface draws inspiration from World of Warcraft's quest log: clean panel-based layout with pixel art decorative elements, gold accents, and a sense of weight and progression.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI |
| Database | SQLite via SQLModel (or raw SQLite with aiosqlite) |
| Frontend | Pure HTML5, CSS3, Vanilla JavaScript (no framework) |
| Auth | JWT tokens stored in localStorage, bcrypt password hashing |
| Deployment | Docker + Docker Compose |
| Mobile | Mobile-responsive PWA (manifest.json + service worker) |

---

## Deployment

- Packaged as a `docker-compose.yml` with a single service
- SQLite database stored in a Docker volume for persistence
- Single `.env` file for configuration (SECRET_KEY, PORT, etc.)
- Accessible on local network via configurable port (default: 8420)
- PWA installable from iPhone/Android browser via "Add to Home Screen"

---

## User System

- Multi-user support: multiple users can share a single instance
- Each user has their own completely isolated dashboard
- **No admin user / no cross-user visibility**
- User registration happens on the **login screen** (not behind a wall)
- Registration: username + password only
- Password stored as bcrypt hash
- JWT-based session (token stored in localStorage)
- No password reset for now
- No email required

### API Endpoints (Auth)
```
POST /api/auth/register   — create new account
POST /api/auth/login      — get JWT token
GET  /api/auth/me         — get current user info
```

---

## Quest Types

All quests are created by the user. Each quest has:
- A **title** (e.g. "No fast food")
- An **emoji icon** (user-picked, used as the quest's avatar)
- A **description** (optional)
- A **type** (see below)
- A **failure mode** (hard reset or freeze lives)

### 1. Streak Quest
Daily yes/no check-in. Did you do (or avoid) this today?

- Tracks current streak (days) and best streak
- Check-in window: user marks the day as success or failure
- Example: "No fast food", "No nail biting", "Meditated"

### 2. Counter Quest
Daily numeric target. Did you hit your number today?

- User sets a daily target value and unit (e.g. 2 L, 10000 steps)
- User logs a value each day
- Day is counted as success if logged value ≥ target
- Tracks current streak of successful days
- Example: "Drink 2L of water", "Walk 10,000 steps"

### 3. Boss Battle Quest
Reach a specific numeric target by a deadline.

- User sets: target value, current value, unit, deadline date
- User logs updates to current value over time
- No streak mechanic — progress bar toward the goal
- Marked as **Victory** or **Defeated** at deadline
- Example: "Lose 5kg by March 31", "Read 10 books by end of year"

### 4. Milestone Quest
Open-ended numeric target with no deadline.

- Same as Boss Battle but no deadline pressure
- Completed when target is reached
- Example: "Reach 75kg bodyweight", "Run 500km total"

### 5. Weekly Quota Quest
Hit a target X times per week (rolling 7-day window or calendar week).

- User sets: how many times per week (e.g. 3)
- User logs each occurrence
- Week is a success if quota is met
- Tracks current streak of successful weeks
- Example: "Exercise 3x per week", "Cook at home 5x per week"

---

## Failure Modes

Each Streak, Counter, and Weekly Quota quest has a configurable failure mode set at creation:

### Hard Reset
- Missing a day/week resets the streak to 0 immediately
- No forgiveness
- Best for high-commitment boss-level goals

### Freeze Lives
- User sets a number of lives (1–5)
- Missing a day consumes one life instead of resetting streak
- Lives regenerate: 1 life restored every N days of success (configurable, default: 7)
- When all lives are lost, streak resets to 0
- Lives remaining shown on the quest card as heart icons ❤️
- Best for goals where occasional slip-ups are acceptable

---

## Gamification System

### Streak Display
- Current streak shown prominently on each quest card
- Streak shown as a number + flame icon 🔥
- Best streak shown as a secondary stat

### Combo System
- A **Combo** is the number of quests the user has kept active simultaneously without any streak resets across all quests
- Shown on the main dashboard header as a global stat
- Resets if any quest has a hard reset streak failure
- "Combo x7 Quests Active!" style display

### Badges
Badges are automatically awarded and displayed on the user profile. They are emoji + label combos, auto-generated based on behavior. No image assets needed.

Examples:
| Badge | Condition |
|---|---|
| 🔥 "First Flame" | Complete your first 7-day streak |
| 💀 "Ironclad" | Complete a 30-day streak on a Hard Reset quest |
| ⚡ "Chain Lightning" | Have 3+ quests with active 7-day streaks simultaneously |
| 🏆 "Boss Slayer" | Complete a Boss Battle quest |
| 💧 "Hydrated Hero" | 14-day streak on a Counter quest |
| 🌱 "Seedling" | Create your first quest |
| 🗡️ "Veteran" | Complete 5 quests total |
| 👑 "Legendary" | Complete a 100-day streak on any quest |

Badge list is extensible — add more over time.

---

## Frontend Design

### Aesthetic Direction
**WoW Quest Log meets pixel art arcade cabinet in a clean modern shell.**

- Background: very dark navy/charcoal (`#0f0f1a` range), not pure black
- Panels: slightly lighter dark surface with a subtle pixel-art border/frame (CSS-drawn or SVG, no image assets needed)
- Accent color: **WoW gold** (`#f0b433` or similar) for titles, icons, borders, and interactive elements
- Secondary accent: a muted teal/blue for progress bars and secondary stats
- Typography:
  - Display/headings: a pixel or retro-flavored font (e.g. **Press Start 2P** from Google Fonts for headers only — used sparingly)
  - Body/UI: a clean, readable sans-serif (e.g. **Exo 2** or **Rajdhani**) for everything else — pixel fonts at small sizes are unreadable
- Quest cards styled like WoW quest entries: bordered panels with the emoji icon prominent, quest title in gold, stats below
- Pixel art decorative elements via CSS: corner ornaments on panels, pixel dividers between sections, a subtle scanline or noise texture overlay
- Progress bars styled as XP bars: segmented, slightly glowing

### Layout

```
┌─────────────────────────────────────────┐
│  ⚔️  QuestLog          [username] [logout]│
│      Combo: 🔥 x4 Active                │
├─────────────────────────────────────────┤
│  [Active Quests]  [Completed] [Badges]  │
├─────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ 🥗 Quest │ │ 💧 Quest │ │ 🏋️ Quest │ │
│ │ Streak   │ │ Counter  │ │ BossBtl  │ │
│ │ 🔥 12d   │ │ 🔥 5d    │ │ ████░ 72%│ │
│ │ ❤️❤️❤️   │ │ [Log]    │ │ [Update] │ │
│ └──────────┘ └──────────┘ └──────────┘ │
│                                         │
│              [+ New Quest]              │
└─────────────────────────────────────────┘
```

### Mobile
- Fully responsive: single column on mobile
- Quest cards stack vertically
- Bottom navigation bar on mobile (Home, Badges, Profile)
- PWA manifest for "Add to Home Screen" support
- Touch-friendly tap targets (min 44px)

### Pages / Views
1. **Login / Register** — split panel, pixel art logo, gold accents
2. **Dashboard (Quest Board)** — main view, all active quests as cards
3. **Quest Detail** — full history log, streak calendar heatmap, badge progress
4. **New Quest Form** — quest type selector with descriptions, emoji picker, failure mode config
5. **Badges Page** — grid of earned badges (glowing) and locked badges (dark/greyed)
6. **Profile** — username, stats (total quests, best streak ever, badges earned), combo score

---

## Data Models

```python
# User
id: int
username: str (unique)
hashed_password: str
created_at: datetime

# Quest
id: int
user_id: int (FK)
title: str
emoji: str
description: str | None
type: enum (streak, counter, boss_battle, milestone, weekly_quota)
status: enum (active, completed, failed, paused)
failure_mode: enum (hard_reset, freeze_lives)
lives_max: int | None
lives_remaining: int | None
lives_regen_days: int | None
# For counter quests
daily_target: float | None
unit: str | None
# For boss battle / milestone
numeric_target: float | None
numeric_current: float | None
deadline: date | None
# For weekly quota
weekly_target: int | None
created_at: datetime
completed_at: datetime | None

# QuestLog (daily check-in records)
id: int
quest_id: int (FK)
user_id: int (FK)
logged_at: date
value: float | None  # for counter quests
success: bool
notes: str | None

# Badge
id: int
user_id: int (FK)
badge_key: str  # e.g. "first_flame"
earned_at: datetime
```

---

## API Endpoints

```
# Quests
GET    /api/quests              — list all user's quests
POST   /api/quests              — create new quest
GET    /api/quests/{id}         — get quest detail + log history
PUT    /api/quests/{id}         — update quest settings
DELETE /api/quests/{id}         — delete quest
POST   /api/quests/{id}/checkin — log today's check-in (streak/counter)
POST   /api/quests/{id}/update  — update numeric value (boss battle/milestone)

# Badges
GET    /api/badges              — get user's earned badges

# Stats
GET    /api/stats               — user global stats (combo, totals, best streaks)
```

---

## Badge Engine

A background function runs after every check-in and quest completion to evaluate badge conditions. It checks all badge definitions against the user's current state and awards any newly unlocked badges. Runs synchronously after each relevant API call (no background task needed at this scale).

---

## Project Structure

```
questlog/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── requirements.txt
├── README.md
├── backend/
│   ├── main.py           — FastAPI app, CORS, static files
│   ├── config.py         — settings from env
│   ├── database.py       — SQLite connection, table creation
│   ├── models.py         — SQLModel/dataclass models
│   ├── auth.py           — JWT, bcrypt, auth routes
│   ├── routes/
│   │   ├── quests.py
│   │   ├── badges.py
│   │   └── stats.py
│   ├── services/
│   │   ├── streak.py     — streak calculation logic
│   │   ├── badge_engine.py
│   │   └── combo.py
│   └── static/           — served by FastAPI
│       ├── index.html
│       ├── manifest.json
│       ├── sw.js          — service worker (PWA)
│       ├── css/
│       │   ├── main.css
│       │   ├── pixel.css  — pixel art decorative elements
│       │   └── components.css
│       └── js/
│           ├── app.js     — router, auth state
│           ├── api.js     — fetch wrapper
│           ├── dashboard.js
│           ├── quest-form.js
│           ├── quest-detail.js
│           └── badges.js
```

---

## Implementation Notes for Claude Code

1. **Start with the backend**: models → auth → quest CRUD → check-in logic → badge engine
2. **Streak calculation**: always derive streak from the `QuestLog` table, never store it as a raw int that could get out of sync. Calculate on read.
3. **Frontend fonts**: load from Google Fonts — `Press Start 2P` (headings only, max 16px), `Exo 2` (body, 400/600/700 weights)
4. **Pixel art borders**: implement as CSS `box-shadow` pixel stacks or a repeated SVG border pattern — no external image files
5. **Emoji picker**: use a simple grid of common emojis in a modal — no external library needed
6. **PWA**: include a `manifest.json` and a basic `sw.js` that caches static assets for offline support
7. **JWT**: store token in `localStorage`, include as `Authorization: Bearer <token>` header on all API calls
8. **Daily check-in window**: a quest can only be checked in once per calendar day (UTC). If a user misses a day, a background calculation on next check-in detects the gap and handles the failure mode accordingly.
9. **Docker**: use a multi-stage build or simple single-stage Python image. SQLite file stored in `/data/questlog.db` mounted as a volume.
10. **No external dependencies for styling**: everything in plain CSS. The WoW-inspired aesthetic should be achieved purely through CSS techniques (gradients, box-shadows, borders, pseudo-elements, CSS animations).
