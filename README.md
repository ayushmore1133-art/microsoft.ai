# InterviewIQ — Multi-Agent AI Interview Panel Simulator

Real backend wired onto your existing prototype `index.html`. Visual design is untouched — every
addition uses the existing CSS classes/variables (`.glass`, `.glow-btn`, `.field-input`, etc.).

## Quick start (free — no credit card)

```bash
npm install
cp .env.example .env
```

Then get a **free** Gemini API key (just a Google account, no card, no expiring trial):
1. Go to https://aistudio.google.com/apikey
2. Click "Create API key"
3. Paste it into `.env` as `GEMINI_API_KEY=...`

`.env` already defaults to `LLM_PROVIDER=gemini`, so that's all you need. Then:

```bash
npm start
```

Open `http://localhost:3000` → Upload → **⚡ Load Demo Data** → **Run Panel →**.

### Using Claude instead
If you'd rather use Anthropic's API, set `LLM_PROVIDER=anthropic` in `.env` and fill in
`ANTHROPIC_API_KEY` (new accounts get a small one-time free trial credit at console.anthropic.com).
Nothing else in the code changes — both providers go through the same `callClaudeJSON()` interface.

## Architecture

```
public/index.html      ← your original prototype, + a small orchestration <script> at the bottom
server.js               ← Express app, static hosting, rate limiting, error handler
src/anthropicClient.js  ← LLM client — supports Gemini (default, free) and Anthropic, same interface
src/prompts.js          ← the extractor prompt, 4 distinct agent-persona prompts, debate + judge prompts
src/routes.js           ← the 4 endpoints
src/db.js               ← lowdb (JSON file) session store — every run is inspectable/replayable
src/seedData.js         ← seeded demo resume + transcript
src/sanitize.js         ← strips common prompt-injection phrases from uploaded text
data/sessions.json      ← the lowdb file (git-ignored after first run; a seed empty file is committed)
```

The browser never sees your API key — every LLM call goes through the Express server via
`fetch('/api/...')`.

## Pipeline (matches the brief)

1. **`POST /api/extract`** — one LLM call turns `{resumeText, transcriptText}` into the shared
   `candidateProfile = {skills, experience, claims, contradictions}`. Every `experience`/`claims`
   entry embeds a verbatim quote + source tag, so downstream agents can quote without ever seeing the
   raw text. Creates a session row.

2. **`POST /api/agent-opinion`** — called **4x in parallel** (`Promise.all` from the frontend), one
   isolated LLM call per `agentType` (`technical | hr_culture | hiring_manager | skeptic`), each
   with its own system prompt/lens. No agent's prompt ever contains another agent's output. Responses
   missing a non-empty `quotes[]` are rejected and retried once with a stricter instruction.

3. **`POST /api/debate`** — 4 **new**, still-separate LLM calls. Each agent is shown the other
   three's opinions and is required to name one of them explicitly and agree/disagree/update. If the
   rebuttal text doesn't name another agent, it's rejected and retried once with a stricter prompt.

4. **`POST /api/final-decision`** — one LLM call acting as **Judge**. It does NOT average the four
   scores — it's instructed to weigh evidence quality, stated confidence, and debate outcome
   (survived / rebutted / shifted), and must return an auditable `weightingRationale` string plus
   `unresolvedDisagreements`.

`GET /api/sessions` and `GET /api/sessions/:id` let you replay any past run from the JSON store.

## Notes / trade-offs (given hackathon time)

- **Text in, not file parsing.** The Upload screen's dropzone stayed exactly as-is visually (it's the
  prototype's decorative demo), but real functionality is two textareas + a "Load Demo Data" button,
  since wiring PDF/DOCX parsing wasn't in scope for the endpoint spec. Paste resume/transcript text,
  or click Load Demo Data.
- **Session storage:** lowdb (JSON file) instead of SQLite — zero native build step, same
  inspectability, easy to swap for `better-sqlite3` later if you want real SQL.
- **Voice debate bonus:** not implemented — flagged as a stretch goal in the challenge brief, out of
  scope for the time available.
- **Rate limiting:** 30 req/min/IP across all `/api/*` routes via `express-rate-limit` — enough for a
  demo, tune `server.js` for real traffic.
