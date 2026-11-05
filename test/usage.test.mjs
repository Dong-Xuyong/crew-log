import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as store from "../store.js";
import { fetchPrivateJson } from "../github-file.js";
import {
  costLabel,
  formatMoney,
  formatTokens,
  jobMetaLine,
  normalizeUsage,
  planPools,
  summarize,
  totalLabel,
  usageChipParts,
} from "../usage.js";

const fixture = JSON.parse(readFileSync(new URL("./usage.fixture.json", import.meta.url), "utf8"));

test("token and money formatting matches the chip example", () => {
  assert.equal(formatTokens(1200000), "1.2M");
  assert.equal(formatTokens(1500), "1.5k");
  assert.equal(formatTokens(840000), "840k");
  assert.equal(formatTokens(999), "999");
  assert.equal(formatMoney(0.84, "usd"), "$0.84");
  assert.equal(formatMoney(0.77, "eur"), "€0.77");
});

test("chip is absent unless usage has something to show", () => {
  assert.equal(usageChipParts(undefined), null);
  assert.equal(usageChipParts(null), null);
  assert.equal(usageChipParts({}), null);
  assert.equal(usageChipParts({ source: "manual", eventIds: [] }), null);
  const parts = usageChipParts(fixture.events[0]);
  assert.equal(parts.text, "grok-4.7 · 1.2M tok · $0.84");
  assert.equal(parts.title, "In 820,000 · Out 310,000 · Cache 70,000 · €0.77 · List price");
});

test("job model, agent count, and effort stay optional", () => {
  assert.equal(jobMetaLine({}), "");
  assert.equal(jobMetaLine({ title: "Old job" }), "");
  assert.equal(jobMetaLine({ model: " grok-4.7 ", agent_count: 2, effort: "medium" }), "grok-4.7 · 2 agents · medium effort");
  assert.equal(jobMetaLine({ agent_count: 1 }), "1 agent");
  assert.equal(jobMetaLine({ agent_count: 0 }), "");
});

test("summarize groups models, bots, days, months, and unattributed", () => {
  const usage = normalizeUsage(fixture);
  const summary = summarize(usage, "usd");
  assert.equal(formatMoney(summary.total, "usd"), "$5.06");
  assert.equal(summary.eventCount, 5);
  assert.equal(summary.unattributed.count, 1);
  assert.equal(formatMoney(summary.unattributed.amount, "usd"), "$0.05");
  assert.equal(summary.jobOnly.count, 1);
  assert.equal(formatMoney(summary.jobOnly.amount, "usd"), "$3.40");
  const bots = Object.fromEntries(summary.byBot.map((row) => [row.key, row.amount]));
  assert.equal(formatMoney(bots.grokbot, "usd"), "$0.84");
  assert.equal(formatMoney(bots.cursor, "usd"), "$0.77");
  assert.equal(summary.byMonth.map((row) => row.key).sort().join(","), "2026-10,2026-11");
  const eur = summarize(usage, "eur");
  assert.equal(formatMoney(eur.total, "eur"), "€4.65");
  const pools = planPools(usage);
  assert.equal(pools[0].unit, "usd");
  assert.equal(pools[2].id, "grokbot");
  assert.equal(pools[2].unit, "pct");
  assert.equal(pools[2].used, 18);
});

test("old jobs and entries keep their shape when usage is omitted", () => {
  store.setData({
    jobs: [
      {
        id: "job_old",
        title: "2026-10-06 Old job",
        status: "todo",
        log: [{ id: "log_old", at: "2026-10-06T09:00:00+01:00", memberId: "robin", action: "started", text: "Started." }],
      },
    ],
  });
  const job = store.jobById("job_old");
  assert.equal(Object.prototype.hasOwnProperty.call(job, "usage"), false);
  assert.equal(job.model, undefined);
  assert.equal(job.agent_count, undefined);
  assert.equal(job.effort, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(job.log[0], "usage"), false);
  assert.equal(job.log[0].text, "Started.");
  assert.equal(usageChipParts(job.usage), null);
  assert.equal(jobMetaLine(job), "");
});

test("present usage is kept on the job and the log entry", () => {
  store.setData({
    jobs: [
      {
        id: "job_new",
        title: "New",
        model: "grok-4.7",
        agent_count: 2,
        effort: "high",
        usage: fixture.events[0],
        log: [{ id: "log_new", text: "Did it.", usage: { model: "grok-4.7", usd: 0.12, eur: 0.11 } }],
      },
    ],
  });
  const job = store.jobById("job_new");
  assert.equal(job.usage.model, "grok-4.7");
  assert.equal(job.log[0].usage.usd, 0.12);
  assert.equal(usageChipParts(job.log[0].usage).text, "grok-4.7 · $0.12");
  assert.equal(jobMetaLine(job), "grok-4.7 · 2 agents · high effort");
});

test("percent pools without a dollar limit render as percent used", () => {
  const pools = planPools(normalizeUsage({
    plan: {
      pools: [
        { id: "cursor", label: "Cursor models", usedPct: 17 },
        { id: "other", label: "Other models", usedPct: 59 },
        { id: "cursor", label: "Cursor models", limitUsd: 400, usedUsd: 12.4 },
      ],
    },
  }));
  assert.equal(pools[0].unit, "pct");
  assert.equal(pools[0].used, 17);
  assert.equal(pools[0].limit, null);
  assert.equal(pools[1].used, 59);
  assert.equal(pools[1].limit, null);
  assert.equal(pools[2].unit, "usd");
  assert.equal(pools[2].limit, 400);
});

test("events with null usd stay in counts and tokens and are not priced at zero", () => {
  const summary = summarize(normalizeUsage({
    events: [
      { id: "a", model: "grok-4.7", tokensIn: 1000, tokensOut: 250, usd: null, eur: null, bot: "grokbot" },
      { id: "b", model: "grok-4.7", tokensIn: 500, usd: 0.5, eur: 0.46, bot: "grokbot" },
    ],
  }), "usd");
  assert.equal(summary.eventCount, 2);
  assert.equal(summary.unpriced, 1);
  assert.equal(summary.byModel[0].tokens, 1750);
  assert.equal(summary.byModel[0].count, 2);
  assert.equal(summary.byModel[0].unpriced, 1);
  assert.equal(formatMoney(summary.total, "usd"), "$0.50");
  const euros = summarize(normalizeUsage({
    events: [
      { model: "grok-4.7", tokensIn: 1000, usd: null, eur: null },
      { model: "grok-4.7", tokensIn: 500, usd: 0.5, eur: 0.46 },
    ],
  }), "eur");
  assert.equal(euros.unpriced, 1);
  assert.equal(euros.missingMoney, 0);
  assert.equal(formatMoney(euros.total, "eur"), "€0.46");
  assert.equal(costLabel(summary.byModel[0], "usd"), "$0.50");
  assert.equal(costLabel({ amount: 0, count: 1, unpriced: 1 }, "usd"), "no list price");
  assert.equal(totalLabel({ currency: "usd", total: 0, eventCount: 1, unpriced: 1 }), "no list price");
  assert.equal(usageChipParts({ model: "grok-4.7", tokensIn: 100, usd: null }).text, "grok-4.7 · 100 tok · no list price");
  assert.equal(usageChipParts({ model: "grok-4.7", usd: 0 }).text, "grok-4.7 · $0.00");
  const omitted = summarize(normalizeUsage({ events: [{ model: "gpt-5.1", tokensIn: 10 }] }), "usd");
  assert.equal(omitted.missingMoney, 1);
  assert.equal(omitted.unpriced, 0);
  assert.equal(formatMoney(omitted.total, "usd"), "$0.00");
});

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function textResponse(text, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

test("files over 1 MB load with the raw media type", async () => {
  const calls = [];
  const payload = JSON.stringify({ version: 1, events: [] });
  const fetchImpl = async (url, opts) => {
    calls.push({ url, accept: opts.headers.Accept });
    if (opts.headers.Accept === "application/vnd.github+json") {
      return jsonResponse({ sha: "abc", content: "", size: 1400000, download_url: "https://raw.example/usage.json" });
    }
    if (String(url).includes("/contents/") && opts.headers.Accept === "application/vnd.github.raw") {
      return textResponse(payload);
    }
    throw new Error(`unexpected ${url}`);
  };
  const file = await fetchPrivateJson("Dong-Xuyong/progress-sync", "usage.json", "token", fetchImpl);
  assert.equal(file.sha, "abc");
  assert.equal(file.data.version, 1);
  assert.equal(calls[1].accept, "application/vnd.github.raw");
  assert.equal(calls.length, 2);
});

test("a small file is read from content and a 404 stays missing", async () => {
  const body = JSON.stringify({ app: "crew-log", version: 1 });
  const encoded = Buffer.from(body, "utf8").toString("base64");
  const accepts = [];
  const small = await fetchPrivateJson("Dong-Xuyong/progress-sync", "crew-log.json", "token", async (_url, opts) => {
    accepts.push(opts.headers.Accept);
    return jsonResponse({ sha: "def", content: encoded });
  });
  assert.equal(small.data.app, "crew-log");
  assert.deepEqual(accepts, ["application/vnd.github+json"]);
  const missing = await fetchPrivateJson("Dong-Xuyong/progress-sync", "usage.json", "token", async () => jsonResponse({ message: "Not Found" }, 404));
  assert.equal(missing, null);
});

test("raw failure falls back to the git blob", async () => {
  const payload = JSON.stringify({ version: 1, plan: { name: "Ultra", pools: [] } });
  const urls = [];
  const file = await fetchPrivateJson("Dong-Xuyong/progress-sync", "usage.json", "token", async (url, opts) => {
    urls.push(`${opts.headers.Accept} ${url}`);
    if (opts.headers.Accept === "application/vnd.github+json") {
      return jsonResponse({ sha: "blobsha", content: "", download_url: "https://raw.example/usage.json" });
    }
    if (String(url).includes("/contents/")) return textResponse("", 404);
    if (String(url).includes("raw.example")) return textResponse("", 404);
    if (String(url).includes("/git/blobs/blobsha")) return textResponse(payload);
    throw new Error(url);
  });
  assert.equal(file.data.plan.name, "Ultra");
  assert.ok(urls.some((line) => line.startsWith("application/vnd.github.raw") && line.includes("/git/blobs/blobsha")));
});

test("usage bars say percent used and no list price", async () => {
  const { render } = await import("../views/usage.js");
  const texts = [];
  function h(tag, props, ...children) {
    const node = { tag, props: props || {}, children: [] };
    children.flat(Infinity).forEach((child) => {
      if (child == null || child === false) return;
      if (typeof child === "string" || typeof child === "number") texts.push(String(child));
      node.children.push(child);
    });
    return node;
  }
  const root = {
    setAttribute() {},
    replaceChildren() {},
    append() {},
  };
  render(root, {
    ui: { h, clear(node) { node.replaceChildren(); } },
    store: {
      state: {
        usage: normalizeUsage({
          plan: {
            name: "Ultra",
            pools: [
              { id: "cursor", label: "Cursor models", usedPct: 17 },
              { id: "other", label: "Other models", usedPct: 59 },
              { id: "grokbot", label: "Grok Bot weekly", limitPct: 100, usedPct: 18 },
            ],
          },
          events: [
            { model: "grok-4.7", tokensIn: 1000, usd: null, bot: "grokbot" },
            { model: "grok-4.7", tokensIn: 500, usd: 0.5, bot: "grokbot" },
          ],
        }),
      },
      fmtDate: (value) => value,
      fmtDateTime: (value) => value,
    },
  });
  assert.ok(texts.includes("17% used"));
  assert.ok(texts.includes("59% used"));
  assert.ok(texts.includes("18% of 100%"));
  assert.equal(texts.includes("No limit set"), false);
  assert.ok(texts.includes("1 event has no list price."));
  assert.ok(texts.some((line) => line.includes("1 no list price")));
  assert.ok(texts.includes("$0.50"));
});

test("a usage file that is not an object is ignored", () => {
  assert.equal(normalizeUsage(null), null);
  assert.equal(normalizeUsage([]), null);
  const empty = normalizeUsage({ version: 1 });
  assert.equal(empty.events.length, 0);
  assert.equal(summarize(empty, "usd").total, 0);
});
