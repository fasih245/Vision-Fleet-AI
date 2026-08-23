# VisionFleet AI — Model Selection Testing Guide

Purpose: pick a replacement for the deprecated `llama-3.3-70b-versatile` by measuring actual candidates against your actual documents, instead of guessing from a spec sheet. Rule to hold yourself to throughout: **pick the smallest model that clears your accuracy bar** — don't default to the biggest one "just in case," since that directly fights the low-token/free-tier goal.

---

## 0. Why you can't just read the `/models` list and decide

The `/models` endpoint (and Groq's docs page) tells you model IDs and context window sizes. It does **not** tell you:
- Real-world answer quality on *your* documents (résumés, reports, whatever you actually upload).
- Your account's actual rate limits per model.

Both of those only exist as data once you generate them yourself — that's what this guide walks through. This isn't a gap in how you've been searching; that information genuinely isn't published anywhere centralized.

---

## 1. Get your real rate-limit numbers first (filters out candidates before quality even matters)

1. Go to [console.groq.com](https://console.groq.com) → **Settings → Limits** (or the equivalent limits page for your account tier).
2. For each model you're considering, note down: **RPM** (requests/minute), **TPM** (tokens/minute), **RPD** (requests/day).
3. Cross out any model whose limits are clearly too tight for your expected usage (see §2 for how to size "expected usage").

### On raw generation speed ("TPS") — this is *not* your bottleneck
Groq's entire product is built around very high raw token-generation speed across nearly all hosted models — that's the whole point of their hardware. Chasing a specific tokens-per-second number is not where your real constraint lives. The thing that actually caps how many users/messages you can serve is the **RPM/TPM ceiling**, not generation speed. Don't optimize for TPS; optimize for RPM/TPM headroom relative to your real usage.

### Sizing your actual RPM/TPM need
Fill in your own numbers:
```
Expected concurrent users at peak:        ____
Average seconds between messages/user:    ____
→ Target RPM  ≈ (concurrent users) × (60 / seconds between messages)
→ Target TPM  ≈ Target RPM × (avg tokens per request)
```
Avg tokens per request with the app as currently built: roughly **900–2,100** (system prompt + RAG context + conversation history + question — see the token-usage logging in §3). Use 2,000 as a safe planning number until you have real logged data.

### On "Groq Compound" specifically
Compound is Groq's **agentic** system — it can decide to call tools like web search or code execution, orchestrating multiple models under the hood. Your use case (answer strictly from a user's own uploaded documents) doesn't need tool use, and an agentic system:
- Adds latency and token overhead from its own internal tool-call reasoning steps — works against the low-token goal.
- Can technically decide to browse the web instead of sticking to the retrieved document context, which would break the "answer ONLY from the provided context" requirement your prompt currently enforces.
- Typically carries tighter free-tier limits than a plain instruction model, being a heavier system.

Recommendation: **don't default to Compound for this use case.** Include it in the eval below as one candidate if you want hard data instead of my judgment call, but go in expecting it to lose on both cost and groundedness to a plain fast instruction model.

---

## 2. Build your question set (do this once)

Pick 10–15 questions against documents you've actually uploaded. Mix easy lookups with harder ones so the eval actually discriminates between candidates.

| # | Question | Source Document | Expected Answer / Key Facts | Notes |
|---|----------|-----------------|------------------------------|-------|
| 1 | | | | e.g. simple fact lookup |
| 2 | | | | e.g. requires combining 2 chunks |
| 3 | | | | e.g. answer should be "not found" |
| 4 | | | | e.g. multi-turn follow-up (tests context window) |
| 5 | | | | |
| ... | | | | |

Include **at least 2 questions that are follow-ups to a previous question** in the same conversation (e.g., Q4 = "what about last year?" referring back to Q3) — this specifically tests the new conversation-memory feature, not just raw document QA.

Include **at least 1 question with no answer in your documents** — a good model says so; a bad one hallucinates.

---

## 3. Run each candidate

1. Get your shortlist from `GET https://api.groq.com/openai/v1/models` (filtered by §1's rate-limit check).
2. For each candidate, one at a time:
   - Set `LLM_MODEL=<candidate-id>` in `backend/.env`.
   - Restart the backend (`python main.py`).
   - Run through your full question set from §2, via the UI or `curl`.
   - **After every response, check the backend terminal** for the line:
     ```
     🔢 Token usage — prompt: XXX, completion: YYY, total: ZZZ
     ```
     This was just added specifically for this testing pass — log every value into your results table (§5).
   - Note wall-clock response time (stopwatch is fine — you're comparing relative speed, not benchmarking precisely).
   - Watch for `429` errors — if you hit one, note at which question number.

---

## 4. Scoring rubric (score each answer 0–2 unless noted)

| Criterion | 0 | 1 | 2 |
|---|---|---|---|
| **Correctness** | Wrong / contradicts source | Partially right, missing key detail | Fully correct |
| **Citation accuracy** | Cites wrong doc/chunk or no citation | Vague citation | Correctly names the specific source |
| **Groundedness** | Hallucinated info not in your docs | Mostly grounded, minor invention | Fully grounded, or correctly says "not found" |
| **Context-window recall** (follow-up questions only) | Ignores prior turn entirely | Partial recall | Correctly references the earlier turn |

## 5. Results log — copy this table per candidate model

```
Model ID: _______________________

| Q# | Correctness | Citation | Groundedness | Context Recall | Prompt Tok | Completion Tok | Total Tok | Latency (s) | 429 hit? |
|----|-------------|----------|--------------|-----------------|------------|-----------------|-----------|-------------|----------|
| 1  |             |          |              |                 |            |                 |           |             |          |
| 2  |             |          |              |                 |            |                 |           |             |          |
...

Totals / Averages:
  Avg correctness:      ___ / 2
  Avg citation:         ___ / 2
  Avg groundedness:     ___ / 2
  Avg context recall:   ___ / 2
  Avg total tokens/req: ___
  Avg latency:          ___ s
  Any 429s during normal-pace testing?  Y / N
```

---

## 6. Decision rule

1. **Disqualify** any candidate that hit a 429 during normal-pace testing (§1's RPM math was wrong for that model, or the limit is too tight for your real usage).
2. Among survivors, disqualify any with an average correctness or groundedness score below **1.5/2** — a fast, cheap model that's wrong isn't a real candidate.
3. Among what's left, **pick the one with the lowest average total tokens/request.** This is the "smallest model that clears your bar" rule — don't let a marginally higher correctness score on a much larger/pricier model win unless the smaller ones genuinely failed the 1.5/2 bar in step 2.
4. Set the winner as `LLM_MODEL` in `backend/.env` and leave it there — that's the entire deployment step, since the model name is now centralized to one place in the code.

---

## Appendix: quick reference commands

**List models your key can access:**
```cmd
curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer %GROQ_API_KEY%"
```

**Swap the active model (no code change needed anymore):**
```env
# backend/.env
LLM_MODEL=your-chosen-model-id
```
Then restart the backend.

**Where to find your real rate limits:**
[console.groq.com](https://console.groq.com) → Settings → Limits
