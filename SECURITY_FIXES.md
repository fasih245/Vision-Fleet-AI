# Security Fixes Log — Vision Fleet AI

Log of vulnerabilities found in the 2026-08-17 security audit, what was actually
wrong, what was changed, and why. Ordered by severity. Each entry answers three
questions: what was the original mistake, what did we change, and why does the
change fix it.

Status key: ✅ Fixed | ⏸ Deferred (needs a decision/action from you first)

---

## ✅ 1. [CRITICAL] Broken authentication → IDOR (any user's data readable/deletable)

**Files:** `backend/routes/upload.py`, `backend/routes/chat.py`

**Original mistake:**
`get_user_id_from_token()` was supposed to return either a real, Supabase-verified
user id, or `None` to mean "not authenticated." Instead, on every failure path
(no Supabase client configured, token verification threw an exception, or the
token was simply invalid/expired) it returned the *string* `"anonymous"` instead
of `None`. Meanwhile, every ownership check in the file was written as:

```python
if doc.data['user_id'] != user_id and user_id != "anonymous":
    raise HTTPException(status_code=403, detail="Unauthorized")
```

The `and user_id != "anonymous"` clause meant: *if the caller's identity is
"anonymous", skip the ownership check entirely.* Combined with the bug above,
sending literally any invalid bearer token (`Authorization: Bearer garbage`)
made `get_user_id_from_token()` return `"anonymous"`, which then sailed straight
through the ownership check — regardless of who actually owned the document or
conversation being accessed. Because the backend talks to Supabase using the
**service-role key** (which bypasses Row-Level Security by design), there was no
second layer of defense behind this check. Net effect: an unauthenticated
attacker could list, read, and delete any other user's uploaded documents and
chat conversations.

**What changed:**
- `get_user_id_from_token()` now returns `None` on *every* failure path (missing
  header, empty token, no Supabase client, verification exception, or no user on
  the response) — never a sentinel string that could be mistaken for a real
  identity.
- Removed the `and user_id != "anonymous"` / `and requesting_user_id != "anonymous"`
  exemption from all four ownership checks:
  - `GET /api/documents/{user_id}` (`upload.py`)
  - `DELETE /api/documents/{document_id}` (`upload.py`)
  - `GET /api/conversations/{conversation_id}/messages` (`chat.py`)
  - `DELETE /api/conversations/{conversation_id}` (`chat.py`)

**Why this fixes it:**
A failed/invalid token can no longer resolve to a value that ownership checks
treat as privileged. The app's intentional "guest mode" (anonymous uploads and
chats, where documents are stored under the literal `user_id = "anonymous"`)
still works exactly as before for genuinely anonymous requests — but an
anonymous caller can now only ever access resources actually owned by
`"anonymous"`, never another real user's data, because the bypass clause is gone.

---

## ✅ 2. [HIGH] CORS wildcard combined with credentials

**File:** `backend/main.py`

**Original mistake:**
The CORS middleware was configured with `allow_credentials=True` **and** a
literal `"*"` inside the `allow_origins` list, alongside a comment that read
`# Allow all for development (remove in production if needed)` — it was never
removed. Per the CORS spec, a literal `"*"` can't legally be paired with
credentialed requests, so Starlette's `CORSMiddleware` falls back to reflecting
whatever `Origin` header the incoming request sent. The practical effect: **any
website, from any origin, could make authenticated/credentialed requests** to
the API and have the browser honor the response.

**What changed:**
Removed the `"*"` entry from `allow_origins`, leaving only the explicit
allowlist (localhost dev ports, the Netlify production domain, the ngrok tunnel
URL).

**Why this fixes it:**
The browser will now only permit credentialed cross-origin requests from the
domains explicitly listed, closing the "any origin can act as an authenticated
caller" hole. *(Side note, not a security issue but worth knowing: the
`"https://*.netlify.app"` entry doesn't actually work as a wildcard — Starlette
does exact string matching on `allow_origins`, not glob matching — so preview
deploys other than the exact production domain won't get CORS headers unless
you switch to `allow_origin_regex`. Flagging this as a functional note, not
something I changed.)*

---

## ✅ 3. [MEDIUM] Publicly exposed API docs / schema

**File:** `backend/main.py`

**Original mistake:**
FastAPI's auto-generated `/docs`, `/redoc`, and `/openapi.json` were left
enabled unconditionally, and the root `/` endpoint even advertised `"docs": "/docs"`
in its response. Anyone who found the API's URL could browse the complete
endpoint list, request/response schemas, and try requests directly from the
browser — a full map of the attack surface handed out for free.

**What changed:**
The FastAPI app now takes `docs_url` / `redoc_url` / `openapi_url` conditioned
on a new `_is_production = bool(os.getenv("PRODUCTION"))` flag — all three are
set to `None` (disabled) when `PRODUCTION` is set. The root endpoint's `docs`
field and the startup banner's printed docs link now respect the same flag.

**Why this fixes it:**
In whatever environment sets `PRODUCTION=1` (check your Railway env vars —
this flag was already being read elsewhere in the code, e.g. `/health`, so it
should already be set there), the interactive docs and schema are no longer
served at all. Local development is unaffected since `PRODUCTION` won't be set
there.

**⚠️ Action needed from you:** confirm `PRODUCTION` is actually set in your
Railway environment variables — this fix is a no-op if it isn't.

---

## ✅ 4. [MEDIUM] Internal error details leaked to API clients

**Files:** `backend/routes/upload.py`, `backend/routes/chat.py`

**Original mistake:**
Nearly every exception handler returned the raw Python exception text straight
to the caller, e.g. `detail=f"Chat failed: {str(e)}"`, `detail=f"Upload failed: {str(e)}"`,
`detail=f"Vector store error: {str(e)}"`. This can leak internal implementation
details — file paths, library names/versions, database error text, stack
internals — to anyone who can trigger an error, which is useful reconnaissance
for an attacker probing the system.

**What changed:**
Every such `HTTPException(detail=f"...: {str(e)}")` now returns a short, generic
message (e.g. `"Upload failed"`, `"Failed to index document"`), while the
original exception text is still printed server-side (most of these already had
a `print(...)` call right next to them; a couple were missing one and now have
it added) for debugging via logs.

**Why this fixes it:**
Clients — including attackers probing the API — get no more information than
"this failed," while you still have the full detail in your server logs to
debug from.

---

## ⏸ 5. [CRITICAL] Real user PII (résumés) committed to git history

**Files:** `backend/uploads/*.pdf`, `backend/faiss_docs*.pkl`, `backend/faiss_index*.bin`

**Original mistake:**
`backend/.gitignore` lists `backend/uploads/`, `backend/*.pkl`, and
`backend/*.faiss`, but those files were already committed *before* the
`.gitignore` rules were added — a `.gitignore` entry only stops *future*
commits, it does nothing to files already tracked. As a result, real uploaded
résumés (containing a real person's name and presumably contact/work-history
details) and their extracted/vectorized text are sitting in the current commit
on `github.com/fasih245/Vision-Fleet-AI`.

**Why this is deferred:** fixing this properly requires rewriting git history
(`git filter-repo` or BFG) and then **force-pushing**, which is a destructive,
hard-to-reverse action on your shared remote — anyone else with a clone would
need to re-sync afterward. That's a call only you should make, and you'd
separately confirm you understand the consequences (I flagged this explicitly
in an earlier message and held off on purpose).

**Recommended next step, when you're ready:**
1. Confirm whether the GitHub repo is public — that determines urgency.
2. `git rm -r --cached backend/uploads backend/*.pkl backend/*.bin` (stops future
   commits — already partially covered by `.gitignore`, this untracks them).
3. Rewrite history to purge the blobs entirely (`git filter-repo --path backend/uploads --path ... --invert-paths`, or BFG's `--delete-folders`/`--delete-files`).
4. Force-push the rewritten history.
5. Rotate/consider the affected individual's data exposed if the repo was ever public, and notify them if appropriate.

---

## ⏸ 6. [MEDIUM] Outdated dependencies with known CVEs

**File:** `backend/requirements.txt`

**Original mistake:** `langchain==0.1.0` / `langchain-community==0.0.13` (Jan
2024) predate several published CVE fixes (SSRF, unsafe deserialization in
loaders); `python-multipart==0.0.6` has a known DoS (CVE-2024-24762, fixed in
0.0.7).

**Why this is deferred:** bumping major/minor versions of `langchain` in
particular can change APIs and break the RAG pipeline — this needs testing
against your actual document-processing flow, not a blind version bump. Also
noticed `backend/requirements.txt` and `backend/backend.txt` pin different
`supabase` versions (2.9.0 vs 2.3.0); worth reconciling into one source of
truth before touching dependency versions.

**Recommended next step, when you're ready:** bump `python-multipart` to
`>=0.0.7` first (low-risk, isolated fix), then tackle `langchain`/`langchain-community`
version bumps separately with a test pass on upload + chat flows.

---

## Summary

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Auth bypass → IDOR on documents/conversations | Critical | ✅ Fixed |
| 2 | CORS wildcard + credentials | High | ✅ Fixed |
| 3 | Public `/docs` and `/openapi.json` | Medium | ✅ Fixed (needs `PRODUCTION` env var confirmed) |
| 4 | Internal error text leaked to clients | Medium | ✅ Fixed |
| 5 | Real PII committed to git history | Critical | ⏸ Deferred — needs your go-ahead on a force-push |
| 6 | Outdated dependencies (CVEs) | Medium | ⏸ Deferred — needs a testing pass |
