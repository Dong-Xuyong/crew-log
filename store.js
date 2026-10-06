export const STATUSES = ["todo", "in_progress", "blocked", "review", "complete", "cancelled"];
export const STATUS_LABEL = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  review: "Review",
  complete: "Complete",
  cancelled: "Cancelled",
};
export const PRIORITIES = ["urgent", "high", "normal", "low"];
export const PRIORITY_LABEL = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};
export const ACTIONS = ["started", "update", "handoff", "blocked", "done", "comment"];
export const ACTION_LABEL = {
  started: "Started",
  update: "Update",
  handoff: "Handoff",
  blocked: "Blocked",
  done: "Done",
  comment: "Comment",
};

const CACHE_KEY = "crew-log-cache";
const TOKEN_KEY = "dong-gh-sync";
const REPO = "Dong-Xuyong/progress-sync";
const DAY_MS = 24 * 60 * 60 * 1000;

const ymdFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Lisbon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Lisbon",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Lisbon",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Lisbon",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const listeners = new Set();
let seenData = false;

export const state = {
  data: null,
  demo: false,
  loading: false,
  lastSync: null,
  error: null,
  changedIds: new Set(),
};

function emit() {
  const current = Array.from(listeners);
  for (let i = 0; i < current.length; i += 1) {
    try {
      current[i](state);
    } catch (err) {
      void err;
    }
  }
}

function storage() {
  try {
    if (typeof localStorage === "undefined" || localStorage == null) return null;
    if (typeof localStorage.getItem !== "function") return null;
    return localStorage;
  } catch (err) {
    return null;
  }
}

function isRecord(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function recordList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (let i = 0; i < value.length; i += 1) {
    if (isRecord(value[i])) out.push({ ...value[i] });
  }
  return out;
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] === "string") out.push(value[i]);
  }
  return out;
}

function normalizeJob(job) {
  return {
    ...job,
    assignees: stringList(job.assignees),
    tags: stringList(job.tags),
    links: recordList(job.links),
    subtasks: recordList(job.subtasks),
    log: recordList(job.log).map((entry) => ({
      ...entry,
      links: recordList(entry.links),
    })),
  };
}

function normalize(data) {
  const src = isRecord(data) ? { ...data } : {};
  src.divisions = recordList(src.divisions);
  src.members = recordList(src.members);
  src.jobs = recordList(src.jobs).map(normalizeJob);
  return src;
}

function logCount(job) {
  return job && Array.isArray(job.log) ? job.log.length : 0;
}

function diffJobIds(prev, next) {
  const changed = new Set();
  const previous = new Map();
  const prevJobs = prev && Array.isArray(prev.jobs) ? prev.jobs : [];
  for (let i = 0; i < prevJobs.length; i += 1) {
    const job = prevJobs[i];
    if (job && job.id != null) previous.set(String(job.id), job);
  }
  const nextJobs = next && Array.isArray(next.jobs) ? next.jobs : [];
  for (let i = 0; i < nextJobs.length; i += 1) {
    const job = nextJobs[i];
    if (!job || job.id == null) continue;
    const id = String(job.id);
    const old = previous.get(id);
    if (!old || old.updatedAt !== job.updatedAt || logCount(old) !== logCount(job)) {
      changed.add(id);
    }
  }
  return changed;
}

function readCache() {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed) || !isRecord(parsed.data)) return null;
    return parsed.data;
  } catch (err) {
    return null;
  }
}

function writeCache(data) {
  const store = storage();
  if (!store || !data) return;
  try {
    store.setItem(CACHE_KEY, JSON.stringify({ data, savedAt: new Date().toISOString() }));
  } catch (err) {
    void err;
  }
}

function pageWindow() {
  if (typeof window === "undefined") return null;
  return window;
}

function isOffline(err) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message = String((err && err.message) || err || "");
  return /offline|failed to fetch|networkerror|network request failed|load failed|econnrefused|enotfound|internet disconnected/i.test(message);
}

function syncError(err) {
  if (isOffline(err)) return "Offline - showing cached data";
  if (err && err.message) return String(err.message);
  return "Sync failed";
}

function parseInstant(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function partsOf(formatter, date) {
  const map = {};
  const parts = formatter.formatToParts(date);
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i].type !== "literal") map[parts[i].type] = parts[i].value;
  }
  return map;
}

function ymdFromDate(date) {
  const parts = partsOf(ymdFormatter, date);
  if (!parts.year || !parts.month || !parts.day) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function shiftYmd(ymd, deltaDays) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return "";
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + deltaDays));
  const year = utc.getUTCFullYear();
  const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clockFrom(parts) {
  let hour = parts.hour === "24" ? "00" : String(parts.hour || "00");
  const minute = String(parts.minute || "00");
  hour = hour.padStart(2, "0");
  return `${hour}:${minute.padStart(2, "0")}`;
}

function monthName(value) {
  return String(value || "").replace(/\.$/, "");
}

function formatYmdLong(ymd) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0));
  const parts = partsOf(dateFormatter, date);
  if (!parts.day || !parts.month || !parts.year) return "";
  return `${Number(parts.day)} ${monthName(parts.month)} ${parts.year}`;
}

function dataJobs() {
  return state.data && Array.isArray(state.data.jobs) ? state.data.jobs : [];
}

function byUpdatedDesc(a, b) {
  const left = a && a.updatedAt ? String(a.updatedAt) : "";
  const right = b && b.updatedAt ? String(b.updatedAt) : "";
  if (left === right) return 0;
  return left < right ? 1 : -1;
}

function textOf(value) {
  return value == null ? "" : String(value).trim();
}

function memberOnJob(job, memberId) {
  if (!job || !memberId) return false;
  if (job.lead === memberId) return true;
  if (Array.isArray(job.assignees) && job.assignees.includes(memberId)) return true;
  const log = job.log || [];
  for (let i = 0; i < log.length; i += 1) {
    if (log[i] && log[i].memberId === memberId) return true;
  }
  return false;
}

function jobTextHit(job, q) {
  const chunks = [job.title, job.description, job.result];
  const log = job.log || [];
  for (let i = 0; i < log.length; i += 1) {
    if (log[i] && log[i].text) chunks.push(log[i].text);
  }
  for (let i = 0; i < chunks.length; i += 1) {
    if (String(chunks[i] || "").toLowerCase().includes(q)) return true;
  }
  return false;
}

function assigned(job, id) {
  if (!job || !id) return false;
  if (job.lead === id) return true;
  return Array.isArray(job.assignees) && job.assignees.includes(id);
}

function csvEscape(value) {
  if (value == null) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function loadDemo() {
  let seed = {};
  if (typeof fetch === "function") {
    try {
      const response = await fetch("crew-log.seed.json");
      if (response && response.ok) {
        const json = await response.json();
        if (isRecord(json)) seed = json;
      }
    } catch (err) {
      seed = {};
    }
  }
  let demoJobs = [];
  try {
    const mod = await import("./demo.js");
    if (mod && Array.isArray(mod.DEMO_JOBS)) demoJobs = mod.DEMO_JOBS;
  } catch (err) {
    demoJobs = [];
  }
  setData(
    {
      ...seed,
      divisions: Array.isArray(seed.divisions) ? seed.divisions : [],
      members: Array.isArray(seed.members) ? seed.members : [],
      jobs: demoJobs,
    },
    { demo: true },
  );
}

export function setData(data, { demo = false } = {}) {
  const normalized = normalize(data);
  const changedIds = seenData && !state.demo && !demo ? diffJobIds(state.data, normalized) : new Set();
  seenData = true;
  state.data = normalized;
  state.demo = demo;
  state.changedIds = changedIds;
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return function unsubscribe() {
    listeners.delete(fn);
  };
}

export function hasToken() {
  const store = storage();
  if (!store) return false;
  try {
    const raw = store.getItem(TOKEN_KEY);
    if (!raw) return false;
    const cfg = JSON.parse(raw);
    return !!(cfg && typeof cfg.token === "string" && cfg.token.trim());
  } catch (err) {
    return false;
  }
}

export function setToken(token) {
  const store = storage();
  if (!store) return;
  const value = String(token || "").trim();
  if (!value) return;
  store.setItem(TOKEN_KEY, JSON.stringify({ token: value, repo: REPO }));
}

export function clearToken() {
  const store = storage();
  if (!store) return;
  store.removeItem(TOKEN_KEY);
  store.removeItem(CACHE_KEY);
}

export async function refresh() {
  if (!hasToken()) return;
  state.loading = true;
  state.error = null;
  emit();
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      state.error = "Offline - showing cached data";
    } else {
      const root = pageWindow();
      const gh = root && root.GhSync;
      if (!gh || typeof gh.load !== "function") {
        state.error = "GitHub sync unavailable";
      } else {
        await gh.load("crew-log", (incoming) => {
          setData(incoming, { demo: false });
        });
        if (state.data) writeCache(state.data);
        state.lastSync = new Date();
        state.error = null;
      }
    }
  } catch (err) {
    state.error = syncError(err);
  } finally {
    state.loading = false;
    emit();
  }
}

export async function init() {
  state.loading = true;
  state.error = null;
  emit();
  try {
    if (hasToken()) {
      const cached = readCache();
      if (cached) setData(cached, { demo: false });
      await refresh();
    } else {
      await loadDemo();
    }
  } catch (err) {
    state.error = err && err.message ? String(err.message) : "Could not load crew log";
  } finally {
    if (state.loading) {
      state.loading = false;
      emit();
    }
  }
}

export function divisions() {
  return state.data && Array.isArray(state.data.divisions) ? state.data.divisions : [];
}

export function division(id) {
  return divisions().find((item) => item && item.id === id);
}

export function members() {
  return state.data && Array.isArray(state.data.members) ? state.data.members : [];
}

export function member(id) {
  return members().find((item) => item && item.id === id);
}

export function directReports(id) {
  const person = member(id);
  const listed = person && Array.isArray(person.directReports) ? person.directReports : null;
  if (listed && listed.length) {
    const out = [];
    for (let i = 0; i < listed.length; i += 1) {
      const report = member(listed[i]);
      if (report) out.push(report);
    }
    return out;
  }
  return members().filter((item) => item && item.reportsTo === id);
}

export function jobs() {
  return dataJobs();
}

export function jobById(id) {
  return dataJobs().find((job) => job && job.id === id);
}

export function allTags() {
  const tags = new Set();
  const list = dataJobs();
  for (let i = 0; i < list.length; i += 1) {
    const jobTags = list[i].tags || [];
    for (let t = 0; t < jobTags.length; t += 1) tags.add(jobTags[t]);
  }
  return Array.from(tags).sort((a, b) => String(a).localeCompare(String(b)));
}

export function filterJobs(f) {
  const filters = f || {};
  const q = textOf(filters.q).toLowerCase();
  const memberId = textOf(filters.member);
  const status = textOf(filters.status);
  const divisionId = textOf(filters.division);
  const priority = textOf(filters.priority);
  const tag = textOf(filters.tag);
  const from = textOf(filters.from);
  const to = textOf(filters.to);
  const matched = dataJobs().filter((job) => {
    if (status && job.status !== status) return false;
    if (divisionId && job.division !== divisionId) return false;
    if (priority && job.priority !== priority) return false;
    if (tag && !(job.tags || []).includes(tag)) return false;
    if (memberId && !memberOnJob(job, memberId)) return false;
    if (q && !jobTextHit(job, q)) return false;
    if (from || to) {
      const day = lisbonDate(job.updatedAt || job.createdAt);
      if (!day) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
    }
    return true;
  });
  return matched.sort(byUpdatedDesc);
}

export function isOverdue(job, now = new Date()) {
  if (!job || !job.due) return false;
  if (job.status === "complete" || job.status === "cancelled") return false;
  const today = todayLisbon(now);
  if (!today) return false;
  return String(job.due) < today;
}

export function memberStats(id, now = new Date()) {
  const moment = parseInstant(now) || new Date();
  const t = moment.getTime();
  const limit7 = 7 * DAY_MS;
  const limit30 = 30 * DAY_MS;
  let open = 0;
  let done7 = 0;
  let done30 = 0;
  let logs30 = 0;
  let hourSum = 0;
  let hourCount = 0;
  const list = dataJobs();
  for (let i = 0; i < list.length; i += 1) {
    const job = list[i];
    if (assigned(job, id)) {
      if (job.status !== "complete" && job.status !== "cancelled") open += 1;
      if (job.status === "complete" && job.completedAt) {
        const completed = parseInstant(job.completedAt);
        if (completed) {
          const age = t - completed.getTime();
          if (age >= 0 && age <= limit30) {
            done30 += 1;
            if (age <= limit7) done7 += 1;
          }
        }
        const hours = durationHours(job.startedAt || job.createdAt, job.completedAt);
        if (hours != null) {
          hourSum += hours;
          hourCount += 1;
        }
      }
    }
    const log = job.log || [];
    for (let n = 0; n < log.length; n += 1) {
      const entry = log[n];
      if (!entry || entry.memberId !== id || !entry.at) continue;
      const at = parseInstant(entry.at);
      if (!at) continue;
      const age = t - at.getTime();
      if (age >= 0 && age <= limit30) logs30 += 1;
    }
  }
  return {
    open,
    done7,
    done30,
    avgHours: hourCount ? hourSum / hourCount : null,
    logs30,
  };
}

export function memberTimeline(id) {
  const rows = [];
  const list = dataJobs();
  for (let i = 0; i < list.length; i += 1) {
    const job = list[i];
    const log = job.log || [];
    for (let n = 0; n < log.length; n += 1) {
      if (log[n] && log[n].memberId === id) rows.push({ job, entry: log[n] });
    }
  }
  rows.sort((a, b) => String((b.entry && b.entry.at) || "").localeCompare(String((a.entry && a.entry.at) || "")));
  return rows;
}

export function jobTimeline(job) {
  const log = job && Array.isArray(job.log) ? job.log.slice() : [];
  log.sort((a, b) => String((b && b.at) || "").localeCompare(String((a && a.at) || "")));
  return log;
}

export function completedPerDay(days = 14, now = new Date()) {
  const count = Number(days);
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const end = todayLisbon(now);
  if (!end || !n) return [];
  const dates = [];
  for (let i = n - 1; i >= 0; i -= 1) dates.push(shiftYmd(end, -i));
  const totals = new Map();
  for (let i = 0; i < dates.length; i += 1) totals.set(dates[i], 0);
  const list = dataJobs();
  for (let i = 0; i < list.length; i += 1) {
    const job = list[i];
    if (!job || !job.completedAt) continue;
    const day = lisbonDate(job.completedAt);
    if (totals.has(day)) totals.set(day, totals.get(day) + 1);
  }
  return dates.map((date) => ({ date, count: totals.get(date) || 0 }));
}

export function leaderboard(now = new Date()) {
  return members()
    .map((person) => {
      const stats = memberStats(person.id, now);
      return {
        member: person,
        done7: stats.done7,
        done30: stats.done30,
        logs30: stats.logs30,
      };
    })
    .sort((a, b) => b.done30 - a.done30 || b.logs30 - a.logs30);
}

export function blockedJobs() {
  return dataJobs().filter((job) => job && job.status === "blocked").sort(byUpdatedDesc);
}

export function overdueJobs(now = new Date()) {
  return dataJobs().filter((job) => isOverdue(job, now)).sort(byUpdatedDesc);
}

export function lisbonDate(iso) {
  const date = parseInstant(iso);
  if (!date) return "";
  return ymdFromDate(date);
}

export function todayLisbon(now = new Date()) {
  const date = now instanceof Date ? now : parseInstant(now);
  if (!date || Number.isNaN(date.getTime())) return "";
  return ymdFromDate(date);
}

export function fmtDateTime(iso) {
  const date = parseInstant(iso);
  if (!date) return "";
  const parts = partsOf(dateTimeFormatter, date);
  if (!parts.day || !parts.month || !parts.year) return "";
  return `${Number(parts.day)} ${monthName(parts.month)} ${parts.year}, ${clockFrom(parts)} PT`;
}

export function fmtTime(iso) {
  const date = parseInstant(iso);
  if (!date) return "";
  return `${clockFrom(partsOf(timeFormatter, date))} PT`;
}

export function fmtDate(ymdOrIso) {
  if (ymdOrIso == null || ymdOrIso === "") return "";
  const raw = String(ymdOrIso).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return formatYmdLong(raw);
  const ymd = lisbonDate(raw);
  return ymd ? formatYmdLong(ymd) : "";
}

export function relTime(iso, now = new Date()) {
  const date = parseInstant(iso);
  const moment = now instanceof Date ? now : parseInstant(now);
  if (!date || !moment) return "";
  const sec = Math.floor((moment.getTime() - date.getTime()) / 1000);
  if (sec < 0) return fmtDate(iso);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return fmtDate(iso);
}

export function durationHours(fromIso, toIso) {
  const from = parseInstant(fromIso);
  const to = parseInstant(toIso);
  if (!from || !to) return null;
  const hours = (to.getTime() - from.getTime()) / 3600000;
  if (!Number.isFinite(hours) || hours < 0) return null;
  return hours;
}

export function jobsToCSV(list) {
  const header = [
    "id",
    "title",
    "status",
    "priority",
    "division",
    "lead",
    "assignees",
    "tags",
    "due",
    "createdAt",
    "startedAt",
    "completedAt",
    "updatedAt",
    "logCount",
    "result",
  ];
  const rows = Array.isArray(list) ? list : [];
  const lines = [header.join(",")];
  for (let i = 0; i < rows.length; i += 1) {
    const job = rows[i] || {};
    const values = [
      job.id,
      job.title,
      job.status,
      job.priority,
      job.division,
      job.lead,
      Array.isArray(job.assignees) ? job.assignees.join("|") : "",
      Array.isArray(job.tags) ? job.tags.join("|") : "",
      job.due,
      job.createdAt,
      job.startedAt,
      job.completedAt,
      job.updatedAt,
      Array.isArray(job.log) ? job.log.length : 0,
      job.result,
    ];
    lines.push(values.map(csvEscape).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function download(filename, text, mime) {
  if (typeof document === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") return;
  const blob = new Blob([text == null ? "" : String(text)], {
    type: mime || "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "download";
  link.rel = "noopener";
  const parent = document.body || document.documentElement;
  if (!parent) {
    URL.revokeObjectURL(url);
    return;
  }
  parent.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch (err) {
      void err;
    }
  }, 1000);
}
