# CIVilizaTu 🏛

A browser-based Civilization-inspired turn-based strategy game with an AI opponent powered by GroQ LLMs.

Built with **Angular 17** · **FastAPI** · **MongoDB 7** · **GroQ AI** · **Docker Compose**

---

## Features

- **Hex map** with Canvas rendering, fog of war, and smooth combat/movement animations
- **Turn-based gameplay**: move units, attack, found cities, build structures
- **Tech tree** spanning Ancient → Classical → Modern eras (21 technologies)
- **Diplomacy system**: declare war, propose peace, send tribute, form alliances
- **AI opponent** driven by a 3-model GroQ chain (streamed via WebSocket)
- **Victory conditions**: Conquest, Science, Culture, Domination
- **Cheat console** (Ctrl+Shift+D in-game) for development/testing
- **Procedural sound effects** via Web Audio API (no asset files needed)
- **Save/load** game state via backend API

---

## Prerequisites

| Tool | Minimum version |
|---|---|
| Docker | 24+ |
| Docker Compose | v2 (bundled with Docker Desktop) |
| GroQ API key | Free at [console.groq.com](https://console.groq.com) |

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/haritzeizagirre/civilizatu.git
cd civilizatu
```

### 2. Configure environment

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# MongoDB credentials (change in production)
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=adminpass

# JWT secret — change to a long random string in production
SECRET_KEY=change_me_to_a_long_random_string

# GroQ API key — get yours at https://console.groq.com
GROQ_API_KEY=your_groq_api_key_here
```

> **Important**: The AI features will not work without a valid `GROQ_API_KEY`.

### 3. Start

```bash
docker compose up --build
```

First build takes ~3-5 minutes. Subsequent starts are much faster.

| Service | URL |
|---|---|
| Frontend (game UI) | http://localhost:4200 |
| Backend API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| AI service | http://localhost:8001 |

### 4. Create an account

Navigate to http://localhost:4200, click **Register**, create an account, then **Login** and start a new game.

---

## Architecture

```
civilizatu/
├── frontend/          # Angular 17 standalone components
│   ├── src/app/
│   │   ├── core/      # models, services (auth, game, sound)
│   │   └── features/  # auth, lobby, game components
│   └── Dockerfile     # multi-stage: node build → nginx serve
│
├── backend/           # FastAPI (Python 3.12)
│   ├── game_logic/    # turn processing, fog of war, cheats
│   ├── routers/       # auth, games, WebSocket endpoints
│   ├── services/      # ai_client, game_service
│   └── Dockerfile
│
├── ai-service/        # GroQ LLM chain (FastAPI, port 8001)
│   ├── main.py
│   ├── prompt_builder.py
│   └── Dockerfile
│
├── mongo-init/        # MongoDB initialization scripts
└── docker-compose.yml
```

### Request flow

```
Browser → Angular → FastAPI (backend:8000)
                         ↓ WebSocket (AI turn)
                    ai-service:8001 → GroQ API
                         ↓
                    MongoDB (state persistence)
```

---

## Game Controls

| Action | How |
|---|---|
| Select unit / city | Click on hex |
| Move unit | Select unit → click destination |
| Attack | Select unit → click enemy unit |
| Found city | Select Settler → click **Found City** |
| Build structure | Select city → city panel → **Build** |
| End turn | HUD **End Turn** button |
| Technology | HUD 🧪 button |
| Diplomacy | HUD 🤝 button |
| Mute/unmute sounds | HUD 🔊/🔇 button |
| Cheat console | **Ctrl+Shift+D** |

---

## Stopping & Data

```bash
# Stop containers (data persisted in Docker volume)
docker compose down

# Stop and DELETE all game data
docker compose down -v
```

---

## Development

### Run services individually (without Docker)

**Backend** (needs MongoDB running):
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**AI Service**:
```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

**Frontend**:
```bash
cd frontend
npm install
npx ng serve --port 4200
```

### Environment variables (backend)

| Variable | Description | Default |
|---|---|---|
| `MONGO_URI` | Full MongoDB connection string | set by compose |
| `SECRET_KEY` | JWT signing secret | required |
| `GROQ_API_KEY` | GroQ API key | required for AI |
| `AI_SERVICE_URL` | Internal URL of AI service | `http://ai-service:8001` |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| AI turn hangs / "AI error" | Check `GROQ_API_KEY` in `.env`, verify GroQ quota |
| 500 on `/auth/register` | Ensure `bcrypt==3.2.2` in `backend/requirements.txt` (already pinned) |
| Cannot connect to MongoDB | Wait for health-check (up to 60s on first start) |
| Frontend shows blank page | Check `docker logs civilizatu-frontend` for nginx errors |
| WebSocket disconnects immediately | Backend must be healthy before frontend starts — compose handles this |

---

## License

MIT
