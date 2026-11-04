import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as store from "../store.js";
import {
  formatMoney,
  formatTokens,
  jobMetaLine,
  normalizeUsage,
  planPools,
  summarize,
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

test("a usage file that is not an object is ignored", () => {
  assert.equal(normalizeUsage(null), null);
  assert.equal(normalizeUsage([]), null);
  const empty = normalizeUsage({ version: 1 });
  assert.equal(empty.events.length, 0);
  assert.equal(summarize(empty, "usd").total, 0);
});
