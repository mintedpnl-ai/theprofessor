// The Professor: an AI mathematician working on open problems around the clock.
// One agent loop runs on the server; every visitor watches the same stream over Server-Sent Events.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROBLEMS, STAGES, BASE } from "./problems.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = (k, d) => (process.env[k] === undefined || process.env[k] === "" ? d : process.env[k]);

const PORT = Number(env("PORT", 3000));
const MODEL = env("ANTHROPIC_MODEL", "claude-opus-5-5");
const EFFORT = env("EFFORT", "high");                        // low | medium | high | xhigh | max
const MAX_TOKENS = Number(env("MAX_TOKENS", 32000));
const ADMIN_TOKEN = env("ADMIN_TOKEN", "");
const AUTOSTART = env("AUTOSTART", "true") !== "false";      // start working as soon as the server boots
const ONLY_WHEN_WATCHED = env("ONLY_WHEN_WATCHED", "false") === "true";
const ROUND_PAUSE_SEC = Number(env("ROUND_PAUSE_SEC", 120));
const DAILY_ROUND_LIMIT = Number(env("DAILY_ROUND_LIMIT", 0)); // 0 = no limit (true 24/7)
const DATA_DIR = env("DATA_DIR", path.join(__dirname, "data"));
const META = path.join(DATA_DIR, "meta.json");
const STEPS = path.join(DATA_DIR, "steps.jsonl");
const API_KEY = env("ANTHROPIC_API_KEY", "");
const API_URL = env("ANTHROPIC_BASE_URL", "https://api.anthropic.com").replace(/\/$/, "") + "/v1/messages";

/* ---------------- storage: meta.json + append-only steps.jsonl ---------------- */
fs.mkdirSync(DATA_DIR, { recursive: true });
let meta = { idx: 0, auto: true, since: Date.now(), day: { date: "", count: 0 } };
try { meta = { ...meta, ...JSON.parse(fs.readFileSync(META, "utf8")) }; } catch {}
const steps = [];
try {
  for (const line of fs.readFileSync(STEPS, "utf8").split("\n")) if (line.trim()) { try { steps.push(JSON.parse(line)); } catch {} }
} catch {}
function saveMeta() {
  try { fs.writeFileSync(META + ".tmp", JSON.stringify(meta)); fs.renameSync(META + ".tmp", META); }
  catch (e) { console.error("meta save failed:", e.message); }
}
saveMeta();
function addStep(entry) {
  steps.push(entry);
  try { fs.appendFileSync(STEPS, JSON.stringify(entry) + "\n"); } catch (e) { console.error("step save failed:", e.message); }
}
const today = () => new Date().toISOString().slice(0, 10);
const statusOf = (text) => (/STATUS:\s*PARTIAL/i.test(text || "") ? "partial" : "open");

// One row per problem the Professor has worked on, newest activity first.
function notebook() {
  const by = new Map();
  for (const s of steps) {
    let r = by.get(s.problemIdx);
    if (!r) by.set(s.problemIdx, (r = { idx: s.problemIdx, rounds: 0, firstAt: s.at, lastAt: s.at, status: "open", partialRounds: 0, verdict: "", verdictRound: 0 }));
    r.lastAt = Math.max(r.lastAt, s.at);
    if (s.stage === STAGES.length - 1) {
      r.rounds = Math.max(r.rounds, s.round);
      if (statusOf(s.text) === "partial") { r.partialRounds++; r.status = "partial"; }
      if (s.round >= r.verdictRound) { r.verdict = s.text; r.verdictRound = s.round; }
    }
  }
  return [...by.values()].sort((a, b) => b.lastAt - a.lastAt);
}
const roundsFor = (i) => steps.reduce((m, s) => (s.problemIdx === i && s.stage === STAGES.length - 1 ? Math.max(m, s.round) : m), 0);
function stats() {
  const nb = notebook();
  return { since: meta.since, rounds: nb.reduce((n, r) => n + r.rounds, 0), problems: nb.length };
}

/* ---------------- live state + broadcast ---------------- */
const clients = new Set();
let live = { status: "idle", problemIdx: meta.idx, round: 0, stage: 0, text: "", thinking: "", message: "", resumeAt: 0 };

function send(res, event, data) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
function broadcast(event, data) { for (const res of clients) send(res, event, data); }
function snapshot() {
  return { live, problems: PROBLEMS, stages: STAGES.map(({ label, ask }) => ({ label, ask })),
           notebook: notebook(), stats: stats(), viewers: clients.size };
}

// Deltas are batched so a fast stream doesn't flood every browser.
// flush() runs before any full-state message so nobody sees text twice.
let pending = { text: "", thinking: "" }, flushTimer = null;
function flush() {
  clearTimeout(flushTimer); flushTimer = null;
  if (pending.text || pending.thinking) broadcast("delta", pending);
  pending = { text: "", thinking: "" };
}
function pushDelta(kind, s) {
  live[kind] += s; pending[kind] += s;
  if (!flushTimer) flushTimer = setTimeout(flush, 200);
}
function setLive(patch) { flush(); live = { ...live, ...patch, updatedAt: Date.now() }; broadcast("live", live); }
function pushNotebook() { broadcast("notebook", { notebook: notebook(), stats: stats() }); }

/* ---------------- the agent ---------------- */
let running = false, abort = null, wake = null, skipping = false, showThinking = true;
const nap = (ms) => new Promise((r) => { const t = setTimeout(r, ms); wake = () => { clearTimeout(t); r(); }; });

function buildPrompt(i, s, outputs) {
  const p = PROBLEMS[i];
  const earlier = steps.filter((e) => e.problemIdx === i && e.stage === STAGES.length - 1).slice(-2)
    .map((e) => `Round ${e.round} verdict:\n${String(e.text).slice(0, 1500)}`).join("\n\n");
  let ctx = "";
  for (let k = 0; k < s; k++) if (outputs[k]) ctx += `\n\n=== ${STAGES[k].label.toUpperCase()} (this round) ===\n${outputs[k].slice(0, 7000)}`;
  return `${BASE}\n\nPROBLEM: ${p.name} (posed ${p.posed}).\nStatement: ${p.statement}\nBackground: ${p.known}` +
    (earlier ? `\n\nYOUR EARLIER ROUNDS ON THIS PROBLEM:\n${earlier}` : "") + ctx + `\n\n${STAGES[s].prompt}`;
}

class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }

// Streams one Messages API call, pushing thinking and text deltas to viewers as they arrive.
async function streamStage(prompt) {
  const body = {
    model: MODEL, max_tokens: MAX_TOKENS, stream: true,
    thinking: showThinking ? { type: "adaptive", display: "summarized" } : { type: "adaptive" },
    output_config: { effort: EFFORT },
    messages: [{ role: "user", content: prompt }],
  };
  const res = await fetch(API_URL, {
    method: "POST", signal: abort.signal,
    headers: { "content-type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    if (showThinking && res.status === 400 && /display/i.test(msg)) { showThinking = false; return streamStage(prompt); }
    throw new ApiError(res.status, msg.slice(0, 500));
  }
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let cut;
    while ((cut = buf.indexOf("\n\n")) !== -1) {
      const block = buf.slice(0, cut); buf = buf.slice(cut + 2);
      const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
      if (!data) continue;
      let ev; try { ev = JSON.parse(data); } catch { continue; }
      if (ev.type === "content_block_delta") {
        if (ev.delta?.type === "thinking_delta") pushDelta("thinking", ev.delta.thinking || "");
        else if (ev.delta?.type === "text_delta") pushDelta("text", ev.delta.text || "");
      } else if (ev.type === "error") {
        throw new ApiError(529, ev.error?.message || "stream error");
      }
    }
  }
  return live.text;
}

async function runRound(i) {
  const round = roundsFor(i) + 1;
  const outputs = {};
  for (let s = 0; s < STAGES.length; s++) {
    if (!running) return false;
    setLive({ status: "live", problemIdx: i, round, stage: s, text: "", thinking: "", message: "" });
    if (s === 0) pushNotebook();
    abort = new AbortController();
    const text = await streamStage(buildPrompt(i, s, outputs));
    outputs[s] = text;
    addStep({ problemIdx: i, round, stage: s, text, at: Date.now() });
    flush();
    if (s === STAGES.length - 1) pushNotebook();
  }
  if (meta.day.date !== today()) meta.day = { date: today(), count: 0 };
  meta.day.count++; saveMeta();
  return true;
}

async function loop() {
  if (running) return;
  if (!API_KEY) { setLive({ status: "error", message: "The Professor is waiting for an API key." }); return; }
  running = true;
  console.log(`The Professor is at work (model ${MODEL}, effort ${EFFORT})`);
  while (running) {
    if (ONLY_WHEN_WATCHED && clients.size === 0) {
      setLive({ status: "waiting", message: "The Professor resumes when someone tunes in.", text: "", thinking: "" });
      await nap(15000); continue;
    }
    if (meta.day.date !== today()) meta.day = { date: today(), count: 0 };
    if (DAILY_ROUND_LIMIT > 0 && meta.day.count >= DAILY_ROUND_LIMIT) {
      setLive({ status: "paused", message: "The Professor has finished today's work and resumes at midnight UTC.", text: "", thinking: "" });
      await nap(10 * 60 * 1000); continue;
    }
    try {
      const finished = await runRound(meta.idx);
      if (!finished || !running) break;
      if (meta.auto) { meta.idx = (meta.idx + 1) % PROBLEMS.length; saveMeta(); }
      const resumeAt = Date.now() + ROUND_PAUSE_SEC * 1000;
      setLive({ status: "between", problemIdx: meta.idx, message: "", resumeAt });
      await nap(ROUND_PAUSE_SEC * 1000);
    } catch (e) {
      if (!running) break;
      if (skipping) { skipping = false; meta.idx = (meta.idx + 1) % PROBLEMS.length; saveMeta(); continue; }
      console.error("step failed:", e?.status, e?.message);
      if (e?.status === 401 || e?.status === 403) {
        setLive({ status: "error", message: "The Professor's API key was rejected." });
        running = false; break;
      }
      const wait = e?.status === 429 ? 5 * 60 * 1000 : 60 * 1000;
      setLive({ status: "error", message: "The Professor lost the connection and will be back in a moment.", resumeAt: Date.now() + wait });
      await nap(wait);
    }
  }
  running = false; abort = null;
  if (["live", "between", "waiting"].includes(live.status)) setLive({ status: "idle", message: "" });
  console.log("The Professor has stopped");
}
function stop() { running = false; abort?.abort(); wake?.(); }

/* ---------------- http ---------------- */
function json(res, code, body) { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); }
const isAdmin = (req) => ADMIN_TOKEN && req.headers.authorization === `Bearer ${ADMIN_TOKEN}`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");

  if (url.pathname === "/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    flush();
    clients.add(res);
    send(res, "snapshot", snapshot());
    broadcast("viewers", clients.size);
    if (ONLY_WHEN_WATCHED) wake?.();
    const ping = setInterval(() => res.write(": ping\n\n"), 20000);
    req.on("close", () => { clearInterval(ping); clients.delete(res); broadcast("viewers", clients.size); });
    return;
  }

  if (url.pathname === "/health") return json(res, 200, { ok: true, status: live.status, viewers: clients.size });

  // Every round of one problem, newest first.
  const m = url.pathname.match(/^\/api\/problem\/(\d+)$/);
  if (m) {
    const i = Number(m[1]);
    if (!(i >= 0 && i < PROBLEMS.length)) return json(res, 404, { error: "Unknown problem" });
    const rounds = new Map();
    for (const s of steps) if (s.problemIdx === i) {
      if (!rounds.has(s.round)) rounds.set(s.round, []);
      rounds.get(s.round).push({ stage: s.stage, text: s.text, at: s.at });
    }
    return json(res, 200, { rounds: [...rounds.entries()].sort((a, b) => b[0] - a[0]).map(([round, st]) => ({ round, steps: st })) });
  }

  if (url.pathname.startsWith("/api/admin/")) {
    if (req.method !== "POST") return json(res, 405, { error: "Use POST" });
    if (!isAdmin(req)) return json(res, 401, { error: ADMIN_TOKEN ? "Wrong admin token" : "Set ADMIN_TOKEN on the server to enable host controls" });
    const action = url.pathname.slice("/api/admin/".length);
    if (action === "start") { loop(); return json(res, 200, { ok: true }); }
    if (action === "stop") { stop(); return json(res, 200, { ok: true }); }
    if (action === "skip") { if (live.status === "live") { skipping = true; abort?.abort(); } wake?.(); return json(res, 200, { ok: true }); }
    if (action === "select") {
      const i = Number(url.searchParams.get("i"));
      if (!(i >= 0 && i < PROBLEMS.length)) return json(res, 400, { error: "Unknown problem" });
      meta.idx = i; saveMeta();
      if (live.status !== "live") setLive({ problemIdx: i });
      return json(res, 200, { ok: true, note: live.status === "live" ? "Takes effect after the current round." : "" });
    }
    if (action === "auto") { meta.auto = url.searchParams.get("on") !== "false"; saveMeta(); return json(res, 200, { ok: true }); }
    return json(res, 404, { error: "Unknown action" });
  }

  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    return fs.createReadStream(path.join(__dirname, "public/index.html")).pipe(res);
  }
  res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`The Professor is listening on :${PORT}`);
  if (!API_KEY) console.warn("ANTHROPIC_API_KEY is not set: the Professor cannot work.");
  if (AUTOSTART) loop();
});
process.on("SIGTERM", () => { stop(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000); });
