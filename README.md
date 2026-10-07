# The Professor

An AI mathematician that works on famous unsolved problems around the clock, live. Every visitor watches the same stream.

The site has three parts:
1. **Intro**: who the Professor is, plus running totals.
2. **On the board**: the Professor working right now. Each round has five steps (Survey, Angle, Attempt, Referee, Verdict), with its thinking shown in a scratchpad.
3. **The notebook**: every problem it has worked on, most recent first, with the latest verdict and every past round.

No dependencies. Node 20+ only.

## Deploy on Railway

**From GitHub (recommended)**
1. Push this folder to a new GitHub repo.
2. In Railway: **New Project → Deploy from GitHub repo** → pick the repo.
3. Open the service → **Variables** and add:
   - `ANTHROPIC_API_KEY` = your key from console.anthropic.com
   - `ADMIN_TOKEN` = any long random string (unlocks host controls)
4. **Add a Volume** mounted at `/data`, and add the variable `DATA_DIR=/data`. Without this the notebook is wiped on every redeploy.
5. **Settings → Networking → Generate Domain.** That's your public URL. You can also attach your own domain there.

**With the Railway CLI**
```
npm i -g @railway/cli
railway login
railway init
railway up
railway variables --set ANTHROPIC_API_KEY=sk-ant-... --set ADMIN_TOKEN=some-long-secret --set DATA_DIR=/data
railway domain
```
Then add the Volume at `/data` from the Railway dashboard (step 4 above).

The Professor starts working as soon as the server boots and keeps going whether or not anyone is watching.

## Host controls
Visit `https://your-domain/#admin` and paste your `ADMIN_TOKEN` to start, stop, skip a problem, choose the next problem, or turn off auto-advance. Visitors never see this panel.

## Settings (environment variables)

| Variable | Default | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | (required) | Your Claude API key |
| `ADMIN_TOKEN` | (none) | Enables host controls at `/#admin` |
| `DATA_DIR` | `./data` | Where the notebook is saved; set to your volume (`/data`) |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | `claude-sonnet-5-5` is much cheaper |
| `EFFORT` | `high` | Thinking depth: `low`, `medium`, `high`, `xhigh`, `max` |
| `MAX_TOKENS` | `32000` | Cap per step (thinking + answer) |
| `ROUND_PAUSE_SEC` | `120` | Break between rounds |
| `DAILY_ROUND_LIMIT` | `0` | Max rounds per UTC day; `0` = unlimited (true 24/7) |
| `ONLY_WHEN_WATCHED` | `false` | Set `true` to pause when nobody has the site open |
| `AUTOSTART` | `true` | Start working when the server boots |

## Cost
Running 24/7 means the Professor makes API calls all day, every day, and deep thinking on hard problems uses a lot of tokens. Before launch:
- Set a monthly spend limit in the Anthropic Console.
- Watch the first day's usage, then tune `ANTHROPIC_MODEL`, `EFFORT`, `ROUND_PAUSE_SEC` or `DAILY_ROUND_LIMIT`.

## How progress is marked
Each verdict ends with `STATUS: OPEN` or `STATUS: PARTIAL`. A problem shows **Partial progress** only when the Professor's verdict says a rigorous, non-trivial result survived its own referee step. Treat that as a claim worth checking, not a verified theorem. Nothing is ever marked solved.

## Customize
Problems and the five step prompts live in `problems.js`. Add a problem by appending an object with `name`, `posed`, `prize`, `statement` (LaTeX in `$...$`) and `known`.

## Endpoints
- `/` the site
- `/events` the live stream (Server-Sent Events)
- `/api/problem/N` every round of problem N
- `/health` status for Railway's health check
- `POST /api/admin/{start|stop|skip|select?i=N|auto?on=true}` with `Authorization: Bearer <ADMIN_TOKEN>`
