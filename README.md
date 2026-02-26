# ⚔️ QuestLog

A self-hosted, gamified goal tracker with RPG aesthetics. Turn your habits and goals into quests, build streaks, earn badges, and keep your combo alive.

![Stack](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi)
![Stack](https://img.shields.io/badge/SQLite-aiosqlite-003B57?style=flat-square&logo=sqlite)
![Stack](https://img.shields.io/badge/Vanilla_JS-ES_Modules-F7DF1E?style=flat-square&logo=javascript)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)
![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?style=flat-square)

---

## Features

- **5 quest types** — Streak, Counter, Boss Battle, Milestone, Weekly Quota
- **Failure modes** — Hard Reset (no mercy) or Freeze Lives (forgiveness with regeneration)
- **Combo system** — tracks how many quests you're keeping alive simultaneously
- **Badge engine** — 10 badges awarded automatically based on your behaviour
- **Pause / Resume** — put a quest on hold without losing your streak
- **Multi-user** — each account has fully isolated data; no admin required
- **PWA** — installable on iPhone and Android via "Add to Home Screen"
- **No framework** — pure HTML, CSS, and vanilla JS on the frontend

---

## Quest Types

| Type | Description |
|------|-------------|
| 🔥 **Streak** | Daily yes/no check-in. Build a consecutive day streak. |
| 📊 **Counter** | Log a daily numeric value (e.g. 2 L of water). Day is a success if you hit the target. |
| ⚔️ **Boss Battle** | Reach a numeric goal by a deadline. Marked Victory or Defeated at the end. |
| 🏆 **Milestone** | Same as Boss Battle but open-ended — no deadline pressure. |
| 📅 **Weekly Quota** | Log occurrences and hit a target X times per rolling 7-day window. |

---

## Badges

| Badge | Condition |
|-------|-----------|
| 🌱 Seedling | Create your first quest |
| 🔥 First Flame | Reach a 7-day streak |
| 💀 Ironclad | 30-day streak on a Hard Reset quest |
| ⚡ Chain Lightning | 3+ quests with active 7-day streaks simultaneously |
| 🏆 Boss Slayer | Complete a Boss Battle quest |
| 💧 Hydrated Hero | 14-day streak on a Counter quest |
| 🗡️ Veteran | Complete 5 quests total |
| 👑 Legendary | 100-day streak on any quest |
| 📅 Weekly Warrior | 4 consecutive successful weeks on a Weekly Quota quest |
| 🛡️ Untouchable | Keep 5+ quests in your combo simultaneously |

---

## Getting Started

### Prerequisites

- Docker and Docker Compose

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/gillesdelhaes/QuestLog.git
cd QuestLog

# 2. Create your env file
cp .env.example .env

# 3. Set a real secret key
#    Linux/macOS: openssl rand -hex 32
nano .env

# 4. Build and run
docker compose up --build -d
```

The app will be available at **http://localhost:8420** (or the host IP on your local network).

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | *(required)* | JWT signing secret — generate with `openssl rand -hex 32` |
| `PORT` | `8420` | Host port exposed by Docker |
| `DB_PATH` | `/data/questlog.db` | Path to SQLite file inside the container |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` (7 days) | JWT token lifetime |

### Data Persistence

The SQLite database is stored in a named Docker volume (`questlog_data`). It survives container restarts and rebuilds.

```bash
# Stop
docker compose down

# Stop and wipe all data
docker compose down -v
```

---

## Mobile (PWA)

Open the app in Safari (iOS) or Chrome (Android), tap **Share → Add to Home Screen**. The app will behave like a native app with offline static asset caching via the service worker.
This feature is supported but your experience may vary.

---

## License

MIT
