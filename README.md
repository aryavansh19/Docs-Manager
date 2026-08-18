<div align="center">

<img src="frontend/public/favicon.svg" width="88" height="88" alt="DocsFlow" />

# DocsFlow

**Forward it. Forget it. It's filed.**

Send any document to WhatsApp. DocsFlow reads it, names it after what's actually inside,
and files it into the right folder in *your* Google Drive. Ask for it later in plain
language and it comes back.

[![Live](https://img.shields.io/badge/live-docsflow.tech-000000?style=for-the-badge)](https://www.docsflow.tech)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Postgres](https://img.shields.io/badge/Postgres%20+%20pgvector-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![License](https://img.shields.io/badge/license-MIT-black?style=for-the-badge)](LICENSE)

</div>

---

## Why it exists

Filing documents is a chore nobody does. Notes, receipts, ID scans and lecture slides pile
up in a phone's gallery and downloads folder until they're unfindable.

DocsFlow removes the filing step. The only action a user takes is forwarding a file to a
WhatsApp number — something they already do without thinking. Everything after that is
automatic, and the files land in the user's own Drive, not in someone else's cloud.

**Every model runs locally on CPU.** There is no per-token inference bill, and document
contents are never sent to a third-party LLM.

---

## What it does

```
 WhatsApp                  DocsFlow                        Your Google Drive
 ────────                  ────────                        ─────────────────
 forward a PDF   ──────▶   extract text (or OCR)
                           understand what it is
                           name it from its content
                           pick the right folder    ──────▶  Architecture/
                                                              └─ Unit 3 Pipelining.pdf
 "pipelining"    ──────▶   hybrid search + rerank
                 ◀──────   sends the file back
```

- **Documents**: PDF, Word, Excel, PowerPoint, plain text. Text is extracted natively, and
  pages that turn out to be scans fall back to OCR.
- **Photos**: a photo with no readable text still gets understood visually, so a picture of
  a pair of slippers is findable by searching `slippers`, `sandals` or `chappal`.
- **Uncertain cases**: rather than guessing, the bot files the document somewhere safe and
  asks with tap-to-choose buttons. The correction is remembered.
- **Retrieval**: describe the file however you remember it — subject, topic, a phrase from
  inside it, or what the photo shows.

---

## How it works

### Ingestion

Every stage is designed so a failure degrades instead of losing the file.

| # | Stage | Detail |
|---|-------|--------|
| 1 | **Receive** | `POST /webhook` verifies Meta's `X-Hub-Signature-256` HMAC before parsing anything. |
| 2 | **Enqueue** | The job is written to Postgres keyed on the WhatsApp message id, so a Meta retry cannot double-file a document. |
| 3 | **Claim** | A worker claims one job atomically (`FOR UPDATE SKIP LOCKED`) and holds a 30-minute lease, renewed by a heartbeat. A crashed worker's job is recovered, not lost. |
| 4 | **Extract** | PyMuPDF for PDFs, native parsers for Office formats. Pages with almost no text are rendered at 2× and passed through OCR. |
| 5 | **Understand** | Title, summary, keywords, entities and document type. Photos without text are labelled visually with CLIP. |
| 6 | **Name** | The file is named from what it contains — `Slippers indoors 2026-08-18.jpg`, not `image_wamid.HBgMOTE5….jpg`. Names the sender chose are always kept. |
| 7 | **Embed** | One document vector plus one vector per chunk. Images additionally get a CLIP vector. |
| 8 | **Classify** | Rule evidence, lexical overlap and semantic similarity are blended against the user's real folder tree. Below the confidence threshold it asks instead of guessing. |
| 9 | **Store** | Uploaded to Drive with a checksum in `appProperties`, then indexed in Postgres. A failure after upload is compensated, so a file is never indexed without existing. |

Deduplication is by SHA-256, checked against both the database and Drive, so resending the
same file is recognised rather than duplicated.

### Retrieval

```
query ─┬─▶ full-text search  (tsvector over title, keywords, summary, chunks)
       ├─▶ vector search     (384-d embeddings, cosine)
       └─▶ visual search     (CLIP text→image, for photos with no text)
                │
                ▼
      Reciprocal Rank Fusion
                │
                ▼
     cross-encoder re-ranking     ─▶  single confident hit? send the file
                                      otherwise? show a pick-one list
```

Fusing lexical and semantic retrieval covers each one's blind spot: exact filenames and
rare terms that embeddings miss, and paraphrases that keyword search misses. The
cross-encoder then reads query and passage *together*, producing scores comparable across
queries — which is what makes "send it directly" versus "ask the user" a safe decision.

---

## Local model stack

| Model | Role | Notes |
|-------|------|-------|
| `RapidOCR` (ONNX) | OCR | Also returns text-region boxes, so the largest heading becomes the title instead of the first line in reading order. |
| `BAAI/bge-small-en-v1.5` | Text embeddings | 384-d, via FastEmbed. |
| `Qdrant/clip-ViT-B-32` (vision + text) | Image understanding | Matched pair sharing one space, so a text query can retrieve a photo. |
| `Xenova/ms-marco-MiniLM-L-6-v2` | Cross-encoder re-ranker | Calibrated scores, thresholdable. |

CLIP ViT-B/32 was kept after `jina-clip-v1` proved more confident but less accurate at
object naming in testing — it called a backpack a chair at 0.78 confidence. Ranking was
wrong, not just calibration, so the larger model would have cost a schema migration and
lost accuracy.

---

## Tech stack

**Backend** — FastAPI · Uvicorn · Python 3.12 · ONNX Runtime · FastEmbed · RapidOCR ·
PyMuPDF · python-docx · python-pptx · openpyxl · Pillow

**Frontend** — React 19 · Vite 7 · Tailwind CSS 4 · Framer Motion · React Router 7 · Axios

**Data** — Supabase Postgres · pgvector · pg_trgm · Row Level Security · Realtime

**Integrations** — WhatsApp Cloud API · Google Drive API · Google OAuth via Supabase Auth

**Infrastructure** — Vercel (frontend) · AWS EC2 + Nginx + Let's Encrypt + systemd (backend)

---

## Architecture

```
        Browser                         WhatsApp
           │                               │
           ▼                               ▼
   ┌───────────────┐               ┌───────────────┐
   │    Vercel     │               │  Meta Cloud   │
   │  React + Vite │               │      API      │
   └───────┬───────┘               └───────┬───────┘
           │  Bearer JWT                   │  signed webhook
           └───────────────┬───────────────┘
                           ▼
                 ┌─────────────────────┐
                 │   Nginx  (TLS 443)  │
                 │   AWS EC2           │
                 ├─────────────────────┤
                 │  FastAPI            │
                 │   ├─ REST API       │
                 │   ├─ webhook        │
                 │   ├─ queue worker   │
                 │   └─ local models   │
                 └──────┬───────┬──────┘
                        │       │
              ┌─────────▼──┐  ┌─▼─────────────┐
              │  Supabase  │  │ Google Drive  │
              │  Postgres  │  │  user's own   │
              │  pgvector  │  │    storage    │
              └────────────┘  └───────────────┘
```

Metadata, vectors and job state live in Postgres. **File bytes only ever live in the
user's Drive** — DocsFlow stores no document content of its own.

---

## API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/` | — | Health check |
| `GET` | `/webhook` | Verify token | Meta subscription handshake |
| `POST` | `/webhook` | HMAC signature | Incoming WhatsApp messages |
| `POST` | `/create-folders` | Bearer JWT | Build the Drive folder tree |
| `POST` | `/api/upload-syllabus` | Bearer JWT | Parse a syllabus into subjects and units |
| `GET` | `/api/drive/browse` | Bearer JWT | Browse the workspace, ownership-checked |

Browser requests authenticate with the Supabase JWT. Webhook requests are rejected unless
the HMAC signature matches, so `ALLOW_UNSIGNED_WEBHOOKS` must stay `false` in production.

---

## Getting started

### Prerequisites

- Python 3.11+ (3.12 tested)
- Node.js 20+
- A Supabase project
- A Google Cloud OAuth client with the Drive scope
- A WhatsApp Business account on the Meta Cloud API

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env               # then fill it in
uvicorn main:app --reload --port 8001
```

First run downloads the model weights once (a few hundred MB) and caches them.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env               # then fill it in
npm run dev
```

### Database

Apply everything in `supabase/migrations/` in filename order. They create the schema,
pgvector indexes, RLS policies, the hybrid search function and the job-queue RPCs.

### Environment

**`backend/.env`** — server-side only, never exposed to the browser:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database access (bypasses RLS — keep secret) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Refreshing Drive tokens |
| `META_TOKEN`, `PHONE_NUMBER_ID` | Sending WhatsApp messages |
| `VERIFY_TOKEN`, `META_APP_SECRET` | Webhook handshake and signature checks |
| `FRONTEND_URL` | Exact production origin, used for CORS |
| `SESSION_SECRET` | Signing key |
| `ALLOW_UNSIGNED_WEBHOOKS` | Keep `false` in production |
| `EMBEDDING_MODEL`, `RERANK_MODEL`, `IMAGE_VISION_MODEL`, `IMAGE_TEXT_MODEL` | Model overrides |
| `MAX_INGESTION_FILE_BYTES`, `MAX_PDF_PAGES`, `MAX_DOCUMENT_CHUNKS` | Safety limits |

**`frontend/.env`** — inlined into the bundle at build time, so treat as public:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase client (anon key only) |
| `VITE_API_URL` | Backend base URL |
| `VITE_BOT_NUMBER` | WhatsApp number shown to users |

> Vite embeds `VITE_*` values at build time. Changing one in your host's dashboard has no
> effect until you redeploy.

---

## Deployment

**Frontend — Vercel.** Root directory `frontend`, framework Vite, build `npm run build`,
output `dist`. `vercel.json` rewrites all routes to `index.html` for client-side routing.

**Backend — a persistent VM, not serverless.** The process holds several ONNX models in
memory and runs a continuous queue worker, so it needs roughly 2 vCPU and 4–8 GB RAM with a
persistent model cache. Request-scoped serverless is a poor fit: cold starts would reload
the models, and the worker loop would be frozen between invocations.

Current production setup: AWS EC2 (Ubuntu 24.04), a single Uvicorn worker under `systemd`,
Nginx terminating TLS with an auto-renewing Let's Encrypt certificate.

Run **one** worker to start. Extra workers each load their own copy of every model.

---

## Security

- Webhooks verified with an HMAC signature; unsigned requests are rejected.
- Row Level Security on user data, with backend access scoped by user id on every query.
- Drive operations verify the target sits inside the caller's own workspace before acting.
- CORS restricted to the configured production origin.
- The service-role key stays server-side; the browser only ever holds the anon key.
- Google refresh tokens are stored server-side and used only to mint short-lived tokens.
- Secrets are supplied by environment file, never committed.

---

## Project structure

```
backend/
  main.py                 FastAPI app, webhook, queue worker, WhatsApp messaging
  document_pipeline.py    extraction, OCR, embeddings, CLIP, re-ranking, classification
  document_ingestion.py   end-to-end ingest: Drive upload + indexing, with compensation
  drive_search.py         hybrid retrieval and folder matching
  syllabus_parser.py      syllabus PDF → subjects and units
  folder_creator.py       Drive folder tree construction
  google_auth.py          Drive credentials from a stored refresh token
  backfill_visual.py      one-off: add CLIP vectors to already-indexed images
  reclassify_files.py     one-off: re-label and re-file as the classifier improves
  restore_folder_map.py   one-off: rebuild a folder map from Drive

frontend/src/
  pages/                  onboarding, dashboard, verification, legal
  components/             folder tree, file explorer, navigation, animations
  lib/                    runtime config, motion primitives, profile helpers

supabase/migrations/      schema, RLS, pgvector indexes, search and queue RPCs
```

---

## Known limitations

- **WhatsApp test numbers** can only message up to 5 pre-verified recipients. A production
  business number is required before real users can onboard.
- **Folder creation** runs as an in-request background task rather than a durable queue
  job, so a restart mid-build can leave a partial tree. Document ingestion is durable.
- **Text search is English-tuned** (`english` text search configuration and an
  English-language embedding model).
- **Scanned handwriting** OCRs unevenly; such files stay findable by name and visually.
- **No rate limiting** on the API yet — worth adding before public traffic, since the
  inference endpoints are CPU-bound.

---

## Roadmap

- [ ] Durable, leased queue for folder creation
- [ ] Nginx rate limiting on inference paths
- [ ] Readiness endpoint that reports model and dependency health
- [ ] Split web and worker processes so each scales independently
- [ ] Pre-baked model cache in the deployment image to remove first-request latency
- [ ] Multilingual embeddings and text search

---

## License

[MIT](LICENSE)
