<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:000000,45:003B1F,100:00FF9C&height=210&section=header&text=VISIONFLEET%20AI&fontSize=52&fontColor=00FF9C&animation=fadeIn&fontAlignY=34&desc=Intelligent%20Document%20Analysis%20%C2%B7%20Powered%20by%20RAG&descAlignY=54&descSize=15" width="100%"/>

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=700&size=23&duration=2600&pause=800&color=00FF9C&center=true&vCenter=true&width=680&lines=%3E+parsing+documents...;%3E+embedding+with+MiniLM-L6-v2...;%3E+indexing+to+user-scoped+FAISS...;%3E+streaming+tokens+live.+ask+anything._" alt="Typing SVG" />

<br/><br/>

![Python](https://img.shields.io/badge/Python_3.10+-0D1117?style=for-the-badge&logo=python&logoColor=00FF9C)
![FastAPI](https://img.shields.io/badge/FastAPI_0.109-0D1117?style=for-the-badge&logo=fastapi&logoColor=00FF9C)
![React](https://img.shields.io/badge/React_18.2-0D1117?style=for-the-badge&logo=react&logoColor=00FF9C)
![TypeScript](https://img.shields.io/badge/TypeScript_5.3-0D1117?style=for-the-badge&logo=typescript&logoColor=00FF9C)
![Vite](https://img.shields.io/badge/Vite_5.0-0D1117?style=for-the-badge&logo=vite&logoColor=00FF9C)

![LangChain](https://img.shields.io/badge/LangChain-0D1117?style=for-the-badge&logo=langchain&logoColor=00FF9C)
![FAISS](https://img.shields.io/badge/FAISS-0D1117?style=for-the-badge&logo=meta&logoColor=00FF9C)
![Groq](https://img.shields.io/badge/Groq_%28configurable_model%29-0D1117?style=for-the-badge&logo=meta&logoColor=00FF9C)
![Supabase](https://img.shields.io/badge/Supabase-0D1117?style=for-the-badge&logo=supabase&logoColor=00FF9C)
![Tailwind](https://img.shields.io/badge/Tailwind_3.4-0D1117?style=for-the-badge&logo=tailwindcss&logoColor=00FF9C)

<br/>

![Stars](https://img.shields.io/github/stars/fasih245/Vision-Fleet-AI?style=flat-square&color=00FF9C&labelColor=0D1117)
![Forks](https://img.shields.io/github/forks/fasih245/Vision-Fleet-AI?style=flat-square&color=00FF9C&labelColor=0D1117)
![Issues](https://img.shields.io/github/issues/fasih245/Vision-Fleet-AI?style=flat-square&color=00FF9C&labelColor=0D1117)
![Last Commit](https://img.shields.io/github/last-commit/fasih245/Vision-Fleet-AI?style=flat-square&color=00FF9C&labelColor=0D1117)
![License](https://img.shields.io/badge/License-MIT-00FF9C?style=flat-square&labelColor=0D1117)

<br/>

**[Features](#-lsfeatures)** · **[Architecture](#-treearchitecture)** · **[Install](#-installsh)** · **[Usage](#-usage--walkthrough)** · **[API](#-curl-api-reference)** · **[Security](#-catsecuritymd)**

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%"/>

</div>

## `$ whoami --project`

```console
root@visionfleet:~$ cat ./manifest.json
{
  "name"        : "VisionFleet AI",
  "tagline"     : "Chat with your documents. Get answers with receipts.",
  "formats"     : ["PDF", "DOCX", "TXT", "CSV"],
  "retrieval"   : "FAISS · user-scoped index per account",
  "embeddings"  : "sentence-transformers/all-MiniLM-L6-v2",
  "llm"         : "Groq-hosted, configurable via LLM_MODEL",
  "modes"       : ["RAG", "conventional chat"],
  "memory"      : "token-budgeted conversation history per chat",
  "delivery"    : "streamed token-by-token (SSE)",
  "voice"       : ["speech-to-text input", "text-to-speech playback"],
  "status"      : "active"
}
root@visionfleet:~$ _
```

**VisionFleet AI** turns any document pile into a conversation. Upload PDFs, Word docs, plain text,
or CSVs — the platform chunks them, embeds them, and stores the vectors in a **FAISS index scoped to
your account alone**. Ask a question in plain English and watch the answer **type out live** as the
model generates it, built from your own material, with **citations pointing at the exact chunks**
that produced it — and it remembers what you just talked about, so follow-up questions actually work.

Need general conversation instead? Flip the **RAG toggle off** and the same interface becomes a
straight LLM chatbot. One app, two brains.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%"/>

## `$ ls ./features`

<table>
<tr>
<td width="50%" valign="top">

### 📄 Multi-Format Ingestion
PDF, DOCX, TXT, and CSV are parsed, validated, and split into semantic chunks automatically on upload.

</td>
<td width="50%" valign="top">

### 🔐 Strict User Isolation
Every account gets its own index file — `faiss_index_{user_id}.bin`. No cross-tenant leakage by design, not by filter.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🔍 Semantic Vector Search
Sentence Transformers embeddings + FAISS similarity search return the top-K most relevant chunks in milliseconds.

</td>
<td width="50%" valign="top">

### 🔀 RAG Toggle
Switch between grounded document answers and open-ended LLM chat mid-conversation, without reloading.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### ⚡ Live Token Streaming
Responses render token-by-token over Server-Sent Events instead of waiting for the full reply — with a configurable typing speed in Settings.

</td>
<td width="50%" valign="top">

### 🧠 Conversation Memory
Each chat carries a token-budgeted window of prior turns into every request, so follow-up questions have real context — not a blank slate.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🎙️ Voice In, Voice Out
Ask questions by speaking (browser Speech Recognition) and have answers read back to you (Speech Synthesis) — no extra API cost, runs entirely client-side.

</td>
<td width="50%" valign="top">

### 🌗 Light / Dark / System Theme
A real theme system, not just a CSS toggle — persists your choice and follows the OS automatically on "System."

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📊 Source Attribution
Each response ships with filename, chunk index, and relevance score — so you can verify every claim.

</td>
<td width="50%" valign="top">

### 💬 Persistent History
Conversations and messages live in Supabase Postgres. Browse, search, and rename any past conversation from the dedicated History page.

</td>
</tr>
</table>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%"/>

## `$ tree --architecture`

```mermaid
%%{init: {'theme':'dark','themeVariables':{'primaryColor':'#0D1117','primaryTextColor':'#00FF9C','primaryBorderColor':'#00FF9C','lineColor':'#00FF9C','secondaryColor':'#161B22','tertiaryColor':'#161B22','fontFamily':'JetBrains Mono, monospace'}}}%%
flowchart TB
    subgraph CLIENT["🖥️  FRONTEND · React + Vite"]
        U1["Upload UI"]
        U2["Chat Interface<br/>(SSE stream reader)"]
        U3["Supabase Auth"]
        U4["Web Speech API<br/>(STT / TTS)"]
    end

    subgraph API["⚙️  BACKEND · FastAPI"]
        R1["/api/upload"]
        R2["/api/chat<br/>(StreamingResponse)"]
        R3["/api/documents"]
        S1["Document Processor"]
        S2["RAG + History Assembly"]
        S3["Auth Service"]
    end

    subgraph DATA["💾  PERSISTENCE"]
        F1[("FAISS<br/>user-scoped")]
        F2[("Supabase<br/>Postgres")]
        F3["Temp File Store"]
    end

    L1["🤖 Groq · LLM (configurable)"]

    U1 -->|multipart| R1
    U2 -->|JSON + JWT| R2
    U3 -.->|JWT| API
    U4 -.->|browser-native, no network call| U2

    R1 --> S1 --> F3
    S1 --> F1
    S1 --> F2
    R2 --> S2
    R3 --> F2
    S2 -->|top-k search + prior turns| F1
    S2 -->|context + history + query| L1
    L1 -->|token stream| U2
    S3 --> F2
```

<details>
<summary><b>▸ RAG pipeline — step by step</b></summary>

```mermaid
%%{init: {'theme':'dark','themeVariables':{'primaryColor':'#0D1117','primaryTextColor':'#00FF9C','primaryBorderColor':'#00FF9C','lineColor':'#00FF9C','fontFamily':'JetBrains Mono, monospace'}}}%%
graph LR
    A["📤 Upload"] --> B["✂️ Extract Text"]
    B --> C["🧱 Chunk<br/>500 / 50 overlap"]
    C --> D["🔢 Embed<br/>MiniLM-L6-v2"]
    D --> E[("🗂️ FAISS Index<br/>user-scoped")]
    Q["❓ User Query"] --> QE["🔢 Query Embedding"]
    QE --> SS["🔍 Similarity Search"]
    E --> SS
    SS --> TK["📑 Top-K Chunks"]
    H["🧠 Prior Turns<br/>(token-budgeted)"] --> CX
    TK --> CX["🧩 Build Context"]
    CX --> LLM["🤖 Groq LLM"]
    LLM --> STR["⚡ Stream Tokens (SSE)"]
    STR --> OUT["✅ Answer + Citations"]
```
</details>

<details>
<summary><b>▸ Query routing — RAG on vs. off</b></summary>

```mermaid
%%{init: {'theme':'dark','themeVariables':{'primaryColor':'#0D1117','primaryTextColor':'#00FF9C','primaryBorderColor':'#00FF9C','lineColor':'#00FF9C','fontFamily':'JetBrains Mono, monospace'}}}%%
graph TD
    A["User asks a question"] --> B{"RAG enabled?"}
    B -->|Yes| C["Embed query"]
    B -->|No| D["Direct to LLM"]
    C --> E["Search user's FAISS index"]
    E --> F["Retrieve top-K chunks"]
    F --> G["Assemble context window<br/>+ prior conversation turns"]
    G --> H["🤖 Groq LLM"]
    D --> H
    H --> I["Stream response token-by-token"]
    I --> J["Attach source citations"]
```
</details>

<details>
<summary><b>▸ Authentication flow</b></summary>

```mermaid
%%{init: {'theme':'dark','themeVariables':{'primaryColor':'#0D1117','primaryTextColor':'#00FF9C','primaryBorderColor':'#00FF9C','lineColor':'#00FF9C','fontFamily':'JetBrains Mono, monospace'}}}%%
graph LR
    A["Login"] --> B["Supabase Auth"]
    B --> C{"Valid?"}
    C -->|No| E["❌ 401"]
    C -->|Yes| D["🔑 Issue JWT"]
    D --> F["Store client-side"]
    F --> G["Bearer header on every call"]
    G --> H["Backend verifies server-side<br/>on every request — never trusted blindly"]
    H --> I["✅ Scoped access granted"]
```
</details>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%"/>

## `$ cat ./tech-stack`

<details open>
<summary><b>▸ Frontend</b></summary>

| Technology | Purpose | Version |
|:---|:---|:---|
| **React** | UI framework | 18.2 |
| **TypeScript** | Type safety | 5.3 |
| **Vite** | Build tool & dev server | 5.0 |
| **TailwindCSS** | Styling, CSS-variable theming | 3.4 |
| **Radix UI** | Accessible primitives | Latest |
| **react-markdown** + **remark-gfm** | Rendering formatted LLM output (tables, lists, bold) | Latest |
| **rehype-raw** + **rehype-sanitize** | Safe HTML in responses — sanitized, not blind `dangerouslySetInnerHTML` | Latest |
| **Web Speech API** | Voice input/output — native browser, no dependency | — |
| **Axios** | HTTP client | 1.6 |
| **React Router** | Navigation | 6.21 |
| **Supabase JS** | Auth client | 2.39 |

</details>

<details open>
<summary><b>▸ Backend</b></summary>

| Technology | Purpose | Version |
|:---|:---|:---|
| **FastAPI** | API framework, `StreamingResponse` for SSE | 0.109 |
| **Python** | Language | 3.10 – 3.12 |
| **LangChain** | RAG orchestration | 0.1 |
| **FAISS** | Vector store | 1.7 |
| **Sentence Transformers** | Embeddings | 2.3 |
| **Groq API** | LLM inference, streamed | Latest |
| **Supabase** | Postgres + auth | 2.3 |
| **PyPDF2** | PDF parsing | 3.0 |
| **python-docx** | DOCX parsing | 1.1 |

</details>

> **Infrastructure notes**
> - FAISS runs locally with one index file per user: `faiss_index_{user_id}.bin`
> - Supabase provides both the Postgres database and the auth layer, with Row-Level Security backing the direct client-side reads
> - The Groq model is **not hardcoded** — set once via `LLM_MODEL` in `backend/.env` and every call site picks it up. See [`MODEL_TESTING_GUIDE.md`](./MODEL_TESTING_GUIDE.md) if you need to evaluate a replacement.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%"/>

## `$ ./install.sh`

### Prerequisites

```console
$ python --version    # 3.10 – 3.12 (newer versions may lack prebuilt numpy/pandas wheels)
$ node --version      # >= 18.0
$ git --version       # any recent
```

You'll also need a **[Groq API key](https://console.groq.com)** and a **[Supabase project](https://supabase.com)**.

<details open>
<summary><b>▸ 01 — Clone</b></summary>

```bash
git clone https://github.com/fasih245/Vision-Fleet-AI.git
cd Vision-Fleet-AI
```
</details>

<details>
<summary><b>▸ 02 — Backend (FastAPI)</b></summary>

```bash
cd backend

# Conda (recommended)
conda create -n rag-backend python=3.11 -y
conda activate rag-backend

# ...or venv
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install -r requirements.txt
python main.py
```

➜ Backend live at **`http://localhost:8000`**
</details>

<details>
<summary><b>▸ 03 — Frontend (React + Vite)</b></summary>

```bash
cd ..            # back to project root
npm install
npm run dev
```

➜ Frontend live at **`http://localhost:5173`**
</details>

<details>
<summary><b>▸ 04 — Environment variables</b></summary>

**`backend/.env`**
```env
# Required
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional
LLM_MODEL=llama-3.3-70b-versatile   # any chat model your Groq key can access
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Set to any non-empty value to disable /docs and gate other prod-only behavior
PRODUCTION=
```

**`.env`** (project root, frontend)
```env
VITE_API_URL=http://localhost:8000/api
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> ⚠️ **Never commit `.env`.** The service key bypasses row-level security — treat it like a root password. Confirm both `.env` paths are in `.gitignore` (the root `.gitignore` covers both — there's no separate `backend/.gitignore` anymore).
</details>

<details>
<summary><b>▸ 05 — Supabase schema</b></summary>

```sql
-- Documents
CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  title         TEXT NOT NULL,
  content       TEXT,
  source_type   TEXT,
  source_path   TEXT,
  file_size     INTEGER,
  file_type     TEXT,
  chunk_count   INTEGER DEFAULT 0,
  is_processed  BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations
CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  title       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id   UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_message      TEXT NOT NULL,
  bot_response      TEXT NOT NULL,
  retrieved_chunks  JSONB,
  model_used        TEXT,
  response_time_ms  INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id),
  email       TEXT,
  full_name   TEXT,
  username    TEXT UNIQUE,
  phone       TEXT,
  company     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

> Enable **Row-Level Security** on all four tables with policies scoping rows to `auth.uid()`. The frontend queries these tables directly in several places (conversation/document lists, message history) with no manual `user_id` filter — RLS is what keeps that safe.
</details>

<div align="center">

| Service | URL |
|:---|:---|
| 🖥️ Frontend | `http://localhost:5173` |
| ⚙️ API | `http://localhost:8000` |
| 📘 Swagger Docs | `http://localhost:8000/docs` *(dev only — disabled when `PRODUCTION` is set)* |

</div>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%"/>

## `$ usage --walkthrough`

```console
[1] SIGN UP     →  http://localhost:5173  →  create account  →  verify email
[2] UPLOAD      →  sidebar "Upload Document"  →  PDF/DOCX/TXT/CSV
                   →  auto chunk + embed + index  →  appears in library
[3] CHAT        →  new conversation  →  ask a question (typed or spoken 🎙️)
                   →  RAG ON   = grounded answer, streamed live, with citations
                   →  RAG OFF  = general-purpose LLM conversation
                   →  ask a follow-up — it remembers what you just discussed
[4] MANAGE      →  History page: search, rename, or delete past chats
[5] TUNE        →  Settings page: Light/Dark/System theme, default RAG mode,
                   response typing speed
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%"/>

## `$ curl --api-reference`

All endpoints require a JWT: `Authorization: Bearer <token>`

<details open>
<summary><b><code>POST</code> /api/upload — ingest a document</b></summary>

```http
POST /api/upload
Content-Type: multipart/form-data

file: <binary>          # required — PDF | DOCX | TXT | CSV
```
```json
{
  "message": "Successfully processed document.pdf",
  "chunks_created": 42,
  "document_id": "uuid",
  "status": "success"
}
```
</details>

<details>
<summary><b><code>POST</code> /api/chat — ask a question, streamed (SSE)</b></summary>

```http
POST /api/chat
Content-Type: application/json
```
```json
{
  "question": "What is the main topic?",
  "use_rag": true,
  "conversation_id": "uuid"
}
```

Response is `text/event-stream` — one frame per generated chunk, then a final `done` frame:

```
data: {"type": "chunk", "content": "The main "}

data: {"type": "chunk", "content": "topic is..."}

data: {"type": "done", "sources": [{"source": "document.pdf", "chunk_index": 5, "relevance_score": 0.92}], "conversation_id": "uuid"}
```

Prior turns for the same `conversation_id` are automatically pulled in server-side and injected as context — no need to resend history from the client. On error mid-stream, a `{"type": "error", "message": "..."}` frame is sent instead of an HTTP error status (the connection is already open by then).
</details>

<details>
<summary><b><code>GET</code> /api/conversations — list your conversations</b></summary>

```json
{ "conversations": [ ... ], "count": 4 }
```
</details>

<details>
<summary><b><code>GET</code> /api/conversations/{id}/messages — full history for one chat</b></summary>

```json
{ "messages": [ ... ], "count": 12, "conversation_id": "uuid" }
```
</details>

<details>
<summary><b><code>GET</code> /api/documents/{user_id} — list documents</b></summary>

```json
{ "documents": [ ... ], "count": 10 }
```
</details>

<details>
<summary><b><code>DELETE</code> /api/documents/{document_id} — remove a document</b></summary>

```json
{ "message": "Document deleted successfully" }
```
</details>

> 📘 Interactive docs at **`http://localhost:8000/docs`** while the backend is running in development (disabled automatically when `PRODUCTION` is set).

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%"/>

## `$ tree -L 2`

```
Vision-Fleet-AI/
│
├── backend/                        # FastAPI service
│   ├── main.py                     # entry point, CORS, prod-gated docs
│   ├── routes/
│   │   ├── upload.py               # document ingestion
│   │   └── chat.py                 # chat + RAG + streaming + history
│   ├── services/
│   │   ├── document_processor.py   # parsing & chunking
│   │   ├── vector_store.py         # FAISS ops (user-scoped)
│   │   └── dependencies.py         # DI wiring
│   ├── requirements.txt
│   └── uploads/                    # temp file storage (gitignored)
│
├── src/                            # React frontend
│   ├── components/
│   │   ├── chat/chat-interface.tsx # streaming, typewriter, voice I/O
│   │   ├── sidebar/app-sidebar.tsx
│   │   └── ui/                     # Radix-based primitives
│   ├── hooks/
│   │   └── use-theme.tsx           # Light/Dark/System theme provider
│   ├── lib/
│   │   ├── api.ts                  # API client (SSE stream reader)
│   │   ├── supabase.ts             # auth + DB operations
│   │   └── typewriter.ts           # streaming reveal-speed presets
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Index.tsx               # main chat view
│   │   ├── Documents.tsx
│   │   ├── Analytics.tsx
│   │   ├── History.tsx             # browse / search / rename conversations
│   │   ├── Settings.tsx            # theme, RAG default, typing speed
│   │   └── Profile.tsx
│   ├── App.tsx
│   └── main.tsx
│
├── public/
├── SECURITY_FIXES.md               # security audit log — what, why, how fixed
├── MODEL_TESTING_GUIDE.md          # how to evaluate/swap the Groq model
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%"/>

## `$ cat ./SECURITY.md`

VisionFleet AI went through a real hardening pass, not just a feature checklist. Highlights:

- **Server-side token verification on every request** — a token that fails to verify resolves to `None`, never to a privileged fallback identity.
- **Per-request ownership checks** on documents and conversations — closes an IDOR where an unverified caller could read or write another user's data.
- **CORS locked to an explicit origin allowlist** — no wildcard `*` alongside credentialed requests.
- **Sanitized HTML rendering** — LLM responses can contain formatting HTML (e.g. `<br>` inside tables); it's rendered through `rehype-sanitize`, not trusted blindly.
- **Generic client-facing error messages** — internal exception details stay in server logs, not in API responses.
- **Production-gated `/docs`** — interactive API docs disable automatically when `PRODUCTION` is set.

Full write-up, including the original mistake behind each fix and what's still an open item, is in **[`SECURITY_FIXES.md`](./SECURITY_FIXES.md)**.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%"/>

## `$ ./run-tests.sh`

```bash
cd backend && pytest tests/     # backend unit tests
npm run test                    # frontend tests
npm run test:e2e                # end-to-end
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%"/>

## `$ dmesg | grep ERROR`

<details>
<summary><b>▸ CORS errors in the browser console</b></summary>

Add your frontend origin to the CORS allowed-origins list in `backend/main.py`.
</details>

<details>
<summary><b>▸ 401 / 403 on chat or documents</b></summary>

The JWT is missing, expired, or the resource belongs to a different account. Confirm the `Authorization: Bearer <token>` header is attached and re-authenticate if needed.
</details>

<details>
<summary><b>▸ Chat says "model does not exist or you do not have access to it"</b></summary>

Groq deprecates/renames models periodically. Check `GET https://api.groq.com/openai/v1/models` with your key for currently available models, then update `LLM_MODEL` in `backend/.env` — see `MODEL_TESTING_GUIDE.md` for a proper evaluation process instead of guessing.
</details>

<details>
<summary><b>▸ FAISS index not found</b></summary>

Your index is created on first upload. Upload at least one document to initialize `faiss_index_{user_id}.bin`.
</details>

<details>
<summary><b>▸ Groq API rate limit</b></summary>

Wait roughly a minute for the window to reset, or move to a higher Groq tier. Check your account's real RPM/TPM limits at console.groq.com → Settings → Limits before assuming a model is a good fit.
</details>

<details>
<summary><b>▸ Supabase connection failed</b></summary>

Re-check `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `backend/.env` for typos or trailing whitespace.
</details>

<details>
<summary><b>▸ `pip install` fails building numpy/pandas from source</b></summary>

Your Python version is likely too new for prebuilt wheels (numpy 1.26.x tops out around 3.12). Use Python 3.10–3.12 for the backend venv, not the newest installed version.
</details>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%"/>

## `$ cat ./roadmap.md`

```diff
+ [x] Multi-format ingestion (PDF · DOCX · TXT · CSV)
+ [x] FAISS user-scoped vector indexes
+ [x] RAG toggle (grounded ⇄ conventional)
+ [x] Source citations with relevance scores
+ [x] Supabase auth + persistent conversations
+ [x] Streaming token responses (SSE)
+ [x] Conversation memory / context window
+ [x] Voice input (STT) + read-aloud (TTS)
+ [x] Light / Dark / System theme
+ [x] History page — search, rename, delete conversations
+ [x] Security hardening pass (see SECURITY_FIXES.md)
! [ ] Hybrid search (BM25 + dense vectors)
! [ ] Cross-encoder re-ranking layer
- [ ] Docker Compose one-command deploy
- [ ] RAGAS evaluation harness
- [ ] Multi-document comparison queries
- [ ] Hosted deployment (currently local / tunnel-based)
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%"/>

## `$ git log --contributors`

<div align="center">

<a href="https://github.com/fasih245/Vision-Fleet-AI/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=fasih245/Vision-Fleet-AI" />
</a>

</div>

**Contributions welcome.**

```bash
git checkout -b feature/amazing-feature
git commit -m "feat: add amazing feature"
git push origin feature/amazing-feature
# → open a Pull Request
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%"/>

## `$ cat ./credits`

**Built by the VisionFleet Team** — led by **[Fasih Ul Haq](https://github.com/fasih245)**

Standing on the shoulders of [LangChain](https://www.langchain.com/) ·
[Groq](https://groq.com/) ·
[Supabase](https://supabase.com/) ·
[FAISS](https://github.com/facebookresearch/faiss) ·
[Radix UI](https://www.radix-ui.com/)

Licensed under the **[MIT License](LICENSE)**.

📬 Questions or issues? **[Open an issue](https://github.com/fasih245/Vision-Fleet-AI/issues)** — or reach out at **fasihulhaq245@gmail.com**

<div align="center">

<br/>

### ⭐ If VisionFleet AI saved you time, drop a star

<a href="#-visionfleet-ai">⬆ Back to top</a>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:00FF9C,55:003B1F,100:000000&height=150&section=footer" width="100%"/>

</div>
