import { formatMoney, formatTokens, monthLabel, planPools, summarize } from "../usage.js";

let currency = "usd";
let span = "day";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function mount(root, ui, node) {
  if (ui && typeof ui.clear === "function") ui.clear(root);
  else root.replaceChildren();
  root.append(node);
}

function fillPct(used, limit, relativeMax) {
  if (relativeMax != null) {
    if (!(relativeMax > 0) || !(used > 0)) return 0;
    return Math.min(100, Math.max(1, (used / relativeMax) * 100));
  }
  if (!(limit > 0) || !(used > 0)) return 0;
  return Math.min(100, (used / limit) * 100);
}

function maxAmount(rows) {
  let max = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].amount > max) max = rows[i].amount;
  }
  return max;
}

function moneyText(amount, code) {
  return formatMoney(amount, code) || (code === "eur" ? "€0.00" : "$0.00");
}

function subLine(row) {
  const bits = [];
  if (row.tokens) bits.push(`${formatTokens(row.tokens)} tok`);
  if (row.count) bits.push(`${row.count} ${row.count === 1 ? "event" : "events"}`);
  return bits.join(" · ");
}

function panel(ui, title, ...nodes) {
  return ui.h(
    "section",
    { class: "usage-panel" },
    ui.h("h2", { class: "usage-h" }, title),
    ...nodes
  );
}

function toggle(ui, root, ctx, pressed, label, group, value) {
  return ui.h(
    "button",
    {
      type: "button",
      class: cx("usage-toggle", pressed && "is-on"),
      "aria-pressed": pressed ? "true" : "false",
      on: {
        click: () => {
          if (group === "currency") currency = value;
          else span = value;
          render(root, ctx);
        },
      },
    },
    label
  );
}

function meter(ui, label, valueText, pct, over) {
  const width = `${Math.round(pct * 10) / 10}%`;
  return ui.h(
    "div",
    {
      class: "usage-track",
      role: "meter",
      "aria-label": label,
      "aria-valuemin": "0",
      "aria-valuemax": "100",
      "aria-valuenow": String(Math.round(Math.min(100, pct))),
      "aria-valuetext": valueText,
    },
    ui.h("span", { class: cx("usage-fill", over && "is-over"), style: { width } })
  );
}

function barRow(ui, label, value, sub, pct, over, valueText) {
  return ui.h(
    "li",
    { class: "usage-row" },
    ui.h(
      "div",
      { class: "usage-row-top" },
      ui.h("span", { class: "usage-row-label" }, label),
      ui.h("span", { class: "usage-row-value" }, value)
    ),
    sub ? ui.h("p", { class: "usage-row-sub" }, sub) : null,
    meter(ui, label, valueText || value, pct, over)
  );
}

function amountRows(ui, rows, code) {
  if (!rows.length) return ui.h("p", { class: "usage-empty" }, "Nothing in this period.");
  const max = maxAmount(rows);
  return ui.h(
    "ul",
    { class: "usage-list" },
    ...rows.map((row) => {
      const value = moneyText(row.amount, code);
      return barRow(ui, row.label || row.key, value, subLine(row), fillPct(row.amount, 0, max), false, value);
    })
  );
}

function poolRows(ui, store, pools) {
  if (!pools.length) return ui.h("p", { class: "usage-empty" }, "No plan pools.");
  return ui.h(
    "ul",
    { class: "usage-list" },
    ...pools.map((pool) => {
      const pct = pool.unit === "pct";
      const usedText = pct ? `${trimNum(pool.used)}%` : moneyText(pool.used, "usd");
      const limitText = pct ? `${trimNum(pool.limit)}%` : (pool.limit > 0 ? moneyText(pool.limit, "usd") : "");
      const value = limitText ? `${usedText} of ${limitText}` : usedText;
      const ratio = pool.limit > 0 ? pool.used / pool.limit : 0;
      const over = pool.limit > 0 && pool.used > pool.limit;
      const bits = [];
      if (!pool.limit) bits.push("No limit set");
      if (pool.resetsAt) {
        const when = store.fmtDateTime(pool.resetsAt) || pool.resetsAt;
        bits.push(`Resets ${when}`);
      }
      return barRow(ui, pool.label, value, bits.join(" · "), fillPct(pool.used, pool.limit), over, value);
    })
  );
}

function trimNum(n) {
  const rounded = Math.round(Number(n) * 10) / 10;
  if (!Number.isFinite(rounded)) return "0";
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function kpi(ui, label, value) {
  return ui.h(
    "article",
    { class: "usage-kpi" },
    ui.h("p", { class: "usage-kpi-value" }, value),
    ui.h("p", { class: "usage-kpi-label" }, label)
  );
}

function emptyUsage(ui, message) {
  return ui.h("div", { class: "usage" }, ui.empty(message, "chart"));
}

export function render(root, ctx) {
  const { store, ui } = ctx;
  root.setAttribute("data-work-view", "usage");
  const state = store.state || {};
  if (!state.usage) {
    const message = state.usageLoading
      ? "Loading usage…"
      : state.usageError
        ? "Usage data could not be loaded."
        : "No usage data yet";
    mount(root, ui, emptyUsage(ui, message));
    return;
  }

  const summary = summarize(state.usage, currency);
  const pools = planPools(state.usage);
  const code = summary.currency;
  const periodRows = (span === "month" ? summary.byMonth : summary.byDay).map((row) => ({
    ...row,
    label: span === "month" ? (monthLabel(row.key) || row.key) : (store.fmtDate(row.key) || row.key),
  }));
  const updated = state.usage.updatedAt ? store.fmtDateTime(state.usage.updatedAt) : "";
  const planName = state.usage.plan && state.usage.plan.name ? state.usage.plan.name : "";
  const botRows = summary.byBot.slice();
  if (summary.jobOnly.count) {
    botRows.push({ ...summary.jobOnly, key: "Jobs (no bot)", label: "Jobs (no bot)" });
  }
  botRows.push({ ...summary.unattributed, key: "unattributed", label: "unattributed" });

  const currencyName = code === "eur" ? "euro" : "dollar";
  mount(
    root,
    ui,
    ui.h(
      "div",
      { class: "usage" },
      state.usageDemo
        ? ui.h("p", { class: "usage-note" }, "Sample data (?demo=1). This is not live usage.")
        : null,
      ui.h(
        "header",
        { class: "usage-head" },
        ui.h(
          "div",
          { class: "usage-intro" },
          ui.h("h2", { class: "usage-title" }, "Usage"),
          ui.h(
            "p",
            { class: "usage-updated" },
            updated ? `Updated ${updated}` : "No timestamp on this file"
          )
        ),
        ui.h(
          "div",
          { class: "usage-switches" },
          ui.h(
            "div",
            { class: "usage-switch", role: "group", "aria-label": "Currency" },
            toggle(ui, root, ctx, code === "usd", "USD", "currency", "usd"),
            toggle(ui, root, ctx, code === "eur", "EUR", "currency", "eur")
          ),
          ui.h(
            "div",
            { class: "usage-switch", role: "group", "aria-label": "Period" },
            toggle(ui, root, ctx, span === "day", "Day", "span", "day"),
            toggle(ui, root, ctx, span === "month", "Month", "span", "month")
          )
        )
      ),
      ui.h(
        "div",
        { class: "usage-kpis" },
        kpi(ui, "Total", moneyText(summary.total, code)),
        kpi(ui, "Events", String(summary.eventCount)),
        kpi(ui, "Models", String(summary.byModel.length)),
        kpi(ui, "unattributed", moneyText(summary.unattributed.amount, code))
      ),
      summary.missingMoney
        ? ui.h(
            "p",
            { class: "usage-note" },
            `${summary.missingMoney} ${summary.missingMoney === 1 ? "row has" : "rows have"} no ${currencyName} amount and ${summary.missingMoney === 1 ? "counts" : "count"} as ${moneyText(0, code)}.`
          )
        : null,
      pools.length
        ? panel(
            ui,
            planName ? `${planName} plan` : "Plan",
            ui.h("p", { class: "usage-lead" }, "Each bar is used against the pool limit. Dollar pools stay in USD."),
            poolRows(ui, store, pools)
          )
        : null,
      ui.h(
        "div",
        { class: "usage-split" },
        panel(ui, "By model", amountRows(ui, summary.byModel, code)),
        panel(ui, "By bot", amountRows(ui, botRows, code))
      ),
      panel(ui, span === "month" ? "By month" : "By day", amountRows(ui, periodRows, code))
    )
  );
}
