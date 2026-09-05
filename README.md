# AI Project Pulse

> AI-native standup and project health monitoring — MVP demo

Team members submit free-text daily updates. An AI layer parses each update, classifies blockers, tracks recurrence across days, and surfaces escalating risks to managers in a synthesized digest. Managers can confirm, dismiss, or resolve flagged risks in one click.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python 3.12), SQLite, SQLAlchemy |
| AI | Google Gemini 3.5 Flash Lite (free tier, 500 req/day) |
| Frontend | React 18 + Vite |

---

## Prerequisites

- Python 3.12 (`py -3.12 --version`)
- Node.js 18+ (`node --version`)
- A free Gemini API key — [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

---

## Setup

### 1. Backend

```powershell
cd backend

# Create virtualenv with Python 3.12 (required — 3.14 has no pydantic-core wheel)
py -3.12 -m venv venv
.\venv\Scripts\pip install -r requirements.txt

# Add your API key
copy .env.example .env
# Edit .env → set GEMINI_API_KEY=AIza...your key...

# Seed the database (2 projects, 6 users)
.\venv\Scripts\python seed.py

# Start the server
.\venv\Scripts\uvicorn main:app --host 127.0.0.1 --port 8000
```

API docs → **http://localhost:8000/docs**

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

App → **http://localhost:5173**

---

### 3. Deploy to Render (Free Cloud Hosting)

The project includes a multi-stage `Dockerfile` and `render.yaml` for 1-click zero-config deployment:

1. **Push to GitHub**:
   ```powershell
   git push origin main
   ```
2. Go to **[dashboard.render.com](https://dashboard.render.com)**.
3. Click **New +** → **Web Service** → Select repository `bhushan1010/Nxtwave`.
4. Choose **Docker** runtime (automatically detected via `Dockerfile`).
5. In **Environment Variables**, add:
   - `GEMINI_API_KEY` = your Gemini API key
6. Click **Deploy Web Service**.

Render will build the React frontend, package the Python backend, auto-seed the database on startup, and give you a public live URL with zero CORS configuration needed.

## Seeded Data

| ID | Name | Role | Project |
|---|---|---|---|
| 1 | Alice Chen | Employee | Project Alpha — Mobile Redesign |
| 2 | Bob Patel | Employee | Project Alpha — Mobile Redesign |
| 3 | Carol Nguyen | Employee | Project Beta — API Gateway v2 |
| 4 | David Kim | Employee | Project Beta — API Gateway v2 |
| 5 | Eve Ramirez | Manager | Project Alpha — Mobile Redesign |
| 6 | Frank Hassan | Manager | Project Beta — API Gateway v2 |

---

## Project Structure

```
d:\Projects\Nxtwave\
├── backend\
│   ├── database.py             # SQLite connection & session
│   ├── main.py                 # FastAPI application entry point & CORS
│   ├── models.py               # SQLAlchemy ORM models (Project, User, Update, Blocker, Digest)
│   ├── seed.py                 # Seeds test projects & users
│   ├── routers\
│   │   ├── blockers.py         # Blocker retrieval & confirm/dismiss/resolve actions
│   │   ├── digests.py          # Manager digest generation & retrieval
│   │   └── updates.py          # Standup update ingestion & AI dedup pipeline
│   └── services\
│       └── ai_service.py       # Gemini API service (parsing, dedup, synthesis)
└── frontend\
    ├── src\
    │   ├── api.js              # Fetch client wrapper
    │   ├── App.jsx             # Role selector landing view
    │   ├── EmployeeView.jsx    # Standup composer, pulse stream, tracker
    │   └── ManagerView.jsx     # Digest review, risk cards, archive
    └── vite.config.js
```

---

## Architecture

```
Employee submits raw text
        │
        ▼
POST /updates/
        │
        ├─► Gemini (services/ai_service.py): parse → { task, blocker: { present, type, description } }
        │
        └─► If blocker present:
                ├─► Fetch all open/confirmed blockers for project
                ├─► Gemini (services/ai_service.py): semantic dedup — same blocker or new?
                ├─► MATCH    → increment days_recurring on existing row
                └─► NO MATCH → create new Blocker row

Manager clicks Generate Digest
        │
        ▼
POST /digests/generate?project_id=X&date=Y
        │
        ├─► Fetch today's updates
        ├─► Fetch open + confirmed blockers sorted by days_recurring DESC
        └─► Gemini (services/ai_service.py): { summary (narrative), flagged_risks (days_recurring ≥ 2) }
```

---

## Key Design Decisions

- **Single free-text input** — employees write naturally; AI structures the output, not the employee.
- **Semantic dedup via LLM** — "finance hasn't sent keys" and "still waiting on finance for API keys" merge into one blocker row, not two.
- **Escalation at day 2** — day-1 blockers are normal noise; only recurring blockers surface to managers.
- **Concrete suggested_action** — the digest prompt requires WHO + WHAT + WHY the current approach failed. Generic advice is explicitly shown as a bad example in the system prompt.
- **Human-in-the-loop** — manager must Confirm / Dismiss / Resolve each flagged risk.
- **Status semantics**:

| Status | Future digests | Dedup matching |
|---|---|---|
| `open` | ✅ flagged if day ≥ 2 | ✅ matchable |
| `confirmed` | ✅ always flagged | ✅ matchable |
| `dismissed` | ❌ excluded | ❌ excluded |
| `resolved` | ❌ excluded | ❌ excluded |

---

## API Reference

```
POST /updates/                                    Submit a standup update
GET  /updates/?user_id=X                          Get a user's recent updates

GET  /blockers/?project_id=X                      List blockers (days_recurring DESC)
PATCH /blockers/{id}/confirm                      Mark as confirmed risk
PATCH /blockers/{id}/dismiss    { reason }        Dismiss (excluded from future matching)
PATCH /blockers/{id}/resolve                      Mark as resolved

POST /digests/generate?project_id=X&date=Y        Generate digest
GET  /digests/?project_id=X&date=Y                Retrieve stored digest

GET  /projects
GET  /users
GET  /health
```

---

## What I'd Add With More Time

- Real authentication (currently a role selector for demo)
- Slack / Teams webhook to post digests automatically
- Week-over-week blocker trend view for managers
- Employee notification when their blocker is confirmed or resolved
- Scheduled digest generation (auto-run at 6 PM daily)

---
---

# 📹 Demo Script — ~90 Seconds

> **Before recording:** Both servers running. Browser open at `http://localhost:5173`.
> Fresh seed (`python seed.py`). No prior updates for today.

---

### [0:00 – 0:12] — Role selector

> *"AI Project Pulse is a lightweight standup tool where employees write freely and AI does the structuring. Let's start as an employee."*

**Click "I'm an Employee".**

---

### [0:12 – 0:30] — Bob submits a blocked update

> *"Selecting Bob Patel on Project Alpha. One text box — no fields, no dropdowns, just natural language."*

Select **Bob Patel**. Type:

> `"Finished the auth refactor. Starting payments today but blocked — finance still hasn't sent the payment API keys. Been waiting two days."`

**Click Submit Update.**

> *"AI parsed that, classified the blocker as 'waiting-on-person'. Bob sees a simple confirmation — no JSON shown."*

---

### [0:30 – 0:42] — Alice submits a clean update

← Switch Role → **I'm an Employee** → select **Alice Chen**. Type:

> `"Wrapped up push notifications, writing tests now. No blockers today."`

**Click Submit Update.**

> *"Second team member, no blocker. The system logs it."*

---

### [0:42 – 1:02] — Manager generates the digest

← Switch Role → **I'm a Manager**.

> *"Two updates are in. Generating the digest."*

Select **Project Alpha**, today's date. **Click ✨ Generate Digest.**

> *"Gemini synthesizes both updates into a paragraph — not a list, an actual narrative."*

*Point to the summary card.*

> *"Below: one flagged risk. Bob's finance blocker is on day 2, escalated."*

*Point to the card — **Day 2** badge, **waiting_on_person** tag.*

> *"The suggested action is specific: 'Engineering lead should call the finance team lead directly on Slack or phone today — two days of async messages have not produced a response.' Not 'follow up soon'. A real action."*

---

### [1:02 – 1:15] — Manager confirms the risk

**Click ✅ Confirm.**

> *"Manager validates this is a real risk. Card dims — actioned. Status is now 'confirmed' in the database."*

---

### [1:15 – 1:30] — (Optional) Day-3 recurrence

← Switch Role → **I'm an Employee** → **Bob Patel**. Type:

> `"Third day. Still no credentials from finance. Payment integration completely stalled."`

Submit. → **Manager** → **✨ Generate Digest.**

> *"Same blocker, different wording. Gemini recognized the match — days_recurring is now 3, status stays confirmed. One database row, not three."*

---

> **End.** ~90 seconds total.
