# Rehear APD — Backend

FastAPI service that turns spoken classroom instructions into step-by-step audio:
Whisper transcription → GPT-4o-mini instruction extraction → OpenAI TTS → S3,
with PostgreSQL persistence, credit-based usage billing (RevenueCat) and a
LangGraph voice agent over WebSocket.

## Layout

```
backend/
├── main.py                  # entry point: app = create_app()
├── app/
│   ├── factory.py           # builds the FastAPI app (CORS, routers, startup)
│   ├── config.py            # all settings, read once from env / .env
│   ├── database.py          # engine, sessions, schema bootstrap
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # request bodies
│   ├── security.py          # password hashing, JWTs
│   ├── dependencies.py      # get_current_user / get_optional_current_user
│   ├── prompts.py           # LLM system prompts
│   ├── routers/             # HTTP layer only: auth, billing, audio, jobs, system, voice
│   ├── services/            # business logic
│   │   ├── processing.py    #   upload / live workflows + credit metering
│   │   ├── ai.py            #   Whisper, GPT, TTS calls
│   │   ├── jobs.py          #   job persistence, parallel TTS
│   │   ├── billing.py       #   credits, usage periods, RevenueCat sync
│   │   ├── email.py, email_validation.py, google_auth.py, password_reset.py, ...
│   └── voice_agent/         # LangGraph STT → intent → action graph
└── tests/                   # pytest suite (no network, in-memory SQLite)
```

Routers stay thin: they parse the request, call one service function and
return its result.

## Running locally

```bash
python -m venv .venv
.venv/Scripts/activate        # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r requirements-dev.txt
uvicorn main:app --reload --port 10000
```

## Configuration

Set in the environment or `backend/.env` (never commit it). Start from the
template: `cp .env.example .env`.

| Variable | Required | Notes |
|---|---|---|
| `APP_ENV` | | `production` makes a missing `JWT_SECRET` fatal. Default `development`. |
| `JWT_SECRET` | **yes (prod)** | Signs session and reset tokens. |
| `DATABASE_URL` | yes | e.g. `postgresql+psycopg://user:pass@host:5432/audio_instructions` |
| `CORS_ORIGINS` | | Comma-separated. Default `*`; set to the frontend origin in production. |
| `OPENAI_API_KEY` | yes | |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` | yes | TTS audio storage. |
| `EMAIL_USER`, `EMAIL_PASS` | yes | Gmail account for signup OTP emails. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | yes | Password-reset emails. |
| `GOOGLE_OAUTH_CLIENT_IDS` | for Google login | Comma-separated client IDs. |
| `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_AUTH` | for billing | Webhook requests must send `Authorization: <REVENUECAT_WEBHOOK_AUTH>`. |
| `BILLING_*` | | Credit rates and plan catalog — see `app/services/billing.py`. |
| `LOG_LEVEL` | | Default `INFO`. |

## Tests

```bash
pytest            # from backend/
```

The suite fakes OpenAI, S3, SMTP and DNS, and runs against in-memory SQLite,
so it needs no credentials and makes no network calls.
