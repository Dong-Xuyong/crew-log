/**
 * Model usage and cost. Every field is optional.
 * Job cards and log entries with no `usage` object produce no chip.
 * usage.json is a separate file; a 404 means there is nothing to show.
 */

export const USAGE_URL = "https://raw.githubusercontent.com/Dong-Xuyong/progress-sync/main/usage.json";
export const USAGE_FIXTURE = "test/usage.fixture.json";

const SOURCE_LABEL = {
  "cursor-csv": "Cursor CSV",
  "list-price": "List price",
  manual: "Manual",
};

const TOKEN_KEYS = ["tokensIn", "tokensOut", "tokensCache"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const moneyFormat = {
  usd: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
  eur: new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }),
};
const intFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Lisbon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function finite(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function text(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function isRecord(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function demoUsageRequested() {
  try {
    if (typeof location === "undefined" || !location || typeof location.search !== "string") return false;
    return new URLSearchParams(location.search).get("demo") === "1";
  } catch (err) {
    void err;
    return false;
  }
}

export function formatTokens(value) {
  const n = finite(value);
  if (n == null || n < 0) return "";
  if (n < 1000) return String(Math.round(n));
  const units = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "k"],
  ];
  for (let i = 0; i < units.length; i += 1) {
    const div = units[i][0];
    if (n < div && i !== units.length - 1) continue;
    const scaled = n / div;
    const body = scaled >= 100 ? String(Math.round(scaled)) : trim1(scaled);
    return body + units[i][1];
  }
  return String(Math.round(n));
}

function trim1(n) {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatMoney(value, currency) {
  const n = finite(value);
  if (n == null) return "";
  const code = currency === "eur" ? "eur" : "usd";
  const abs = Math.abs(n);
  if (abs > 0 && abs < 0.005) return code === "eur" ? "<€0.01" : "<$0.01";
  return moneyFormat[code].format(n);
}

export function formatTokenCount(value) {
  const n = finite(value);
  if (n == null) return "";
  return intFormat.format(Math.round(n));
}

export function tokenParts(usage) {
  const out = { any: false, total: 0, in: null, out: null, cache: null };
  if (!isRecord(usage)) return out;
  TOKEN_KEYS.forEach((key) => {
    const n = finite(usage[key]);
    if (n == null) return;
    out.any = true;
    out.total += n;
    if (key === "tokensIn") out.in = n;
    else if (key === "tokensOut") out.out = n;
    else out.cache = n;
  });
  return out;
}

export function jobMetaLine(job) {
  if (!isRecord(job)) return "";
  const model = typeof job.model === "string" ? job.model.trim() : "";
  const n = Number.isInteger(job.agent_count) && job.agent_count > 0 ? job.agent_count : 0;
  const effort = typeof job.effort === "string" ? job.effort.trim() : "";
  const parts = [model, n ? `${n} ${n === 1 ? "agent" : "agents"}` : "", effort ? `${effort} effort` : ""].filter(Boolean);
  return parts.join(" \u00b7 ");
}

export function usageChipParts(usage) {
  if (!isRecord(usage)) return null;
  const model = typeof usage.model === "string" ? usage.model.trim() : "";
  const tokens = tokenParts(usage);
  const usd = finite(usage.usd);
  const eur = finite(usage.eur);
  const parts = [];
  if (model) parts.push(model);
  if (tokens.any) parts.push(`${formatTokens(tokens.total)} tok`);
  if (usd != null) parts.push(formatMoney(usd, "usd"));
  else if (eur != null) parts.push(formatMoney(eur, "eur"));
  if (!parts.length) return null;

  const tips = [];
  if (tokens.in != null) tips.push(`In ${formatTokenCount(tokens.in)}`);
  if (tokens.out != null) tips.push(`Out ${formatTokenCount(tokens.out)}`);
  if (tokens.cache != null) tips.push(`Cache ${formatTokenCount(tokens.cache)}`);
  if (eur != null) tips.push(formatMoney(eur, "eur"));
  const source = typeof usage.source === "string" ? usage.source.trim() : "";
  if (source) tips.push(SOURCE_LABEL[source] || source);
  return {
    text: parts.join(" \u00b7 "),
    title: tips.join(" \u00b7 "),
  };
}

export function lisbonDay(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = dayFormat.format(date);
  return /^\d{4}-\d{2}-\d{2}$/.test(formatted) ? formatted : "";
}

export function monthKey(day) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day.slice(0, 7) : "";
}

export function monthLabel(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(key || "");
  if (!match) return key || "";
  const name = MONTHS[Number(match[2]) - 1];
  return name ? `${name} ${match[1]}` : key;
}

function amountOf(record, currency) {
  const key = currency === "eur" ? "eur" : "usd";
  if (typeof record === "number") {
    if (currency === "eur") return { amount: 0, missing: true };
    return { amount: record, missing: false };
  }
  if (!isRecord(record) || !Object.prototype.hasOwnProperty.call(record, key) || record[key] == null || record[key] === "") {
    return { amount: 0, missing: true };
  }
  const n = finite(record[key]);
  if (n == null) return { amount: 0, missing: true };
  return { amount: n, missing: false };
}

function addBucket(map, key, amount, tokens) {
  const name = key || "unknown";
  const row = map.get(name) || { key: name, amount: 0, tokens: 0, count: 0 };
  row.amount += amount;
  row.tokens += tokens;
  row.count += 1;
  map.set(name, row);
}

function sortAmount(rows) {
  return rows.sort((a, b) => b.amount - a.amount || String(a.key).localeCompare(String(b.key)));
}

function sortDayDesc(rows) {
  return rows.sort((a, b) => String(b.key).localeCompare(String(a.key)));
}

function rollNamed(map, source, currency, unattributed) {
  if (!isRecord(source)) return;
  Object.keys(source).forEach((key) => {
    const value = source[key];
    const money = amountOf(value, currency);
    const tokens = tokenParts(value).total;
    if (key === "unattributed" && unattributed) {
      unattributed.amount += money.amount;
      unattributed.tokens += tokens;
      unattributed.count += 1;
      return;
    }
    addBucket(map, key, money.amount, tokens);
  });
}

export function normalizeUsage(data) {
  if (!isRecord(data)) return null;
  const events = Array.isArray(data.events) ? data.events.filter(isRecord) : [];
  const daily = Array.isArray(data.daily) ? data.daily.filter(isRecord) : [];
  const plan = isRecord(data.plan) ? data.plan : null;
  const pools = plan && Array.isArray(plan.pools) ? plan.pools.filter(isRecord) : [];
  return {
    version: data.version == null ? null : data.version,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
    plan: plan ? { name: text(plan.name), pools } : null,
    events,
    daily,
  };
}

export function planPools(usage) {
  const pools = usage && usage.plan && Array.isArray(usage.plan.pools) ? usage.plan.pools : [];
  return pools.map((pool) => {
    const id = text(pool.id);
    const label = text(pool.label) || id || "Pool";
    const usedPct = finite(pool.usedPct);
    const limitPct = finite(pool.limitPct);
    const usedUsd = finite(pool.usedUsd);
    const limitUsd = finite(pool.limitUsd);
    const percentPool = usedPct != null || limitPct != null || (id === "grokbot" && usedUsd == null && limitUsd == null);
    if (percentPool) {
      return {
        id,
        label,
        unit: "pct",
        used: usedPct == null ? 0 : usedPct,
        limit: limitPct == null ? 100 : limitPct,
        resetsAt: text(pool.resetsAt),
      };
    }
    return {
      id,
      label,
      unit: "usd",
      used: usedUsd == null ? 0 : usedUsd,
      limit: limitUsd == null ? 0 : limitUsd,
      resetsAt: text(pool.resetsAt),
    };
  });
}

export function summarize(usage, currency) {
  const code = currency === "eur" ? "eur" : "usd";
  const file = usage && Array.isArray(usage.events) ? usage : { events: [], daily: [] };
  const byModel = new Map();
  const byBot = new Map();
  const byDay = new Map();
  const byMonth = new Map();
  const unattributed = { key: "unattributed", amount: 0, tokens: 0, count: 0 };
  const jobOnly = { key: "jobs", amount: 0, tokens: 0, count: 0 };
  let total = 0;
  let eventCount = 0;
  let missingMoney = 0;

  if (file.events.length) {
    file.events.forEach((event) => {
      const money = amountOf(event, code);
      const tokens = tokenParts(event).total;
      if (money.missing) missingMoney += 1;
      total += money.amount;
      eventCount += 1;
      addBucket(byModel, text(event.model) || "unknown", money.amount, tokens);
      const day = lisbonDay(event.at) || "undated";
      addBucket(byDay, day, money.amount, tokens);
      addBucket(byMonth, monthKey(day) || "undated", money.amount, tokens);
      const bot = text(event.bot);
      const jobId = text(event.jobId);
      if (!bot && !jobId) {
        unattributed.amount += money.amount;
        unattributed.tokens += tokens;
        unattributed.count += 1;
      } else if (!bot && jobId) {
        jobOnly.amount += money.amount;
        jobOnly.tokens += tokens;
        jobOnly.count += 1;
      } else if (bot) {
        addBucket(byBot, bot, money.amount, tokens);
      }
    });
  } else {
    (file.daily || []).forEach((row) => {
      const money = amountOf(row, code);
      if (money.missing) missingMoney += 1;
      total += money.amount;
      const day = text(row.date) || "undated";
      addBucket(byDay, day, money.amount, 0);
      addBucket(byMonth, monthKey(day) || (day.length >= 7 ? day.slice(0, 7) : "undated"), money.amount, 0);
      rollNamed(byModel, row.byModel, code, null);
      rollNamed(byBot, row.byBot, code, unattributed);
    });
  }

  return {
    currency: code,
    total,
    eventCount,
    missingMoney,
    byModel: sortAmount(Array.from(byModel.values())),
    byBot: sortAmount(Array.from(byBot.values())),
    byDay: sortDayDesc(Array.from(byDay.values())),
    byMonth: sortDayDesc(Array.from(byMonth.values())),
    unattributed,
    jobOnly,
    fromEvents: file.events.length > 0,
  };
}

export function previewUsageFromEvent(event) {
  if (!isRecord(event)) return null;
  const usage = {};
  if (text(event.model)) usage.model = text(event.model);
  TOKEN_KEYS.forEach((key) => {
    if (finite(event[key]) != null) usage[key] = finite(event[key]);
  });
  if (finite(event.usd) != null) usage.usd = finite(event.usd);
  if (finite(event.eur) != null) usage.eur = finite(event.eur);
  if (text(event.source)) usage.source = text(event.source);
  if (text(event.id)) usage.eventIds = [text(event.id)];
  return usageChipParts(usage) ? usage : null;
}
