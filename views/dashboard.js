const SVG_NS = "http://www.w3.org/2000/svg";
const WD = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function displayName(member) {
  return member?.name || member?.id || "Unknown";
}

function isYmd(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function addDays(ymd, delta) {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function isOpenStatus(status) {
  return status === "todo" || status === "in_progress" || status === "blocked" || status === "review";
}

function dayLabel(ymd) {
  const [year, month, day] = ymd.split("-").map(Number);
  return `${WD[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]} ${day}`;
}

function lastDays(today, count) {
  if (!isYmd(today)) return [];
  const days = [];
  for (let i = count - 1; i >= 0; i--) days.push(addDays(today, -i));
  return days;
}

function niceMax(n) {
  if (n <= 1) return 1;
  const exp = 10 ** Math.floor(Math.log10(n));
  const fraction = n / exp;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * exp;
}

function svgEl(name, attrs) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value != null) el.setAttribute(key, String(value));
  }
  return el;
}

export function render(root, ctx) {
  const { store, ui, jobs, now, openJob, openMember, go } = ctx;
  const { h } = ui;
  const list = Array.isArray(jobs) ? jobs.filter(Boolean) : [];
  const tally = countJobs(store, list, now);
  const blocked = list.filter((job) => job.id && job.status === "blocked").slice().sort(byUpdatedDesc);
  const overdue = list.filter((job) => job.id && store.isOverdue(job, now)).slice().sort(byDueAsc);

  root.append(h("div", { class: "dash" },
    kpiRow(h, ui, tally),
    h("div", { class: "dash-main" },
      chartPanel(h, store, list, now),
      leaderboard(h, ui, store, now, openMember)
    ),
    h("div", { class: "dash-lists" },
      jobPanel(h, ui, store, "Blocked", blocked, now, openJob, "Nothing blocked. Smooth sailing.", "check-circle"),
      jobPanel(h, ui, store, "Overdue", overdue, now, openJob, "Nothing overdue. Smooth sailing.", "check"),
      automationsPanel(h, ui, store, now, go)
    )
  ));
}

function countJobs(store, jobs, now) {
  const today = store.todayLisbon(now);
  const start = isYmd(today) ? addDays(today, -6) : "";
  const tally = { open: 0, progress: 0, blocked: 0, overdue: 0, done7: 0 };
  for (const job of jobs) {
    if (isOpenStatus(job.status)) tally.open += 1;
    if (job.status === "in_progress") tally.progress += 1;
    if (job.status === "blocked") tally.blocked += 1;
    if (store.isOverdue(job, now)) tally.overdue += 1;
    if (job.status === "complete" && job.completedAt && start) {
      const day = store.lisbonDate(job.completedAt);
      if (isYmd(day) && day >= start && day <= today) tally.done7 += 1;
    }
  }
  return tally;
}

function kpiRow(h, ui, tally) {
  const tiles = [
    ["open", "Open", "board", tally.open],
    ["progress", "In progress", "play", tally.progress],
    ["blocked", "Blocked", "alert", tally.blocked],
    ["overdue", "Overdue", "clock", tally.overdue],
    ["done", "Done 7d", "check-circle", tally.done7]
  ];
  return h("div", { class: "dash-kpis", role: "group", "aria-label": "Crew totals" },
    tiles.map(([tone, label, icon, value]) => h("article", { class: "dash-kpi", "data-tone": tone },
      h("span", { class: "dash-kpi-icon", "aria-hidden": "true" }, ui.icon(icon, { size: 18 })),
      h("div", { class: "dash-kpi-copy" },
        h("p", { class: "dash-kpi-value", text: String(value) }),
        h("p", { class: "dash-kpi-label", text: label })
      )
    ))
  );
}

function chartPanel(h, store, jobs, now) {
  const today = store.todayLisbon(now);
  const days = lastDays(today, 14);
  const series = days.map((date) => ({ date, count: 0 }));
  const index = new Map(series.map((item) => [item.date, item]));
  for (const job of jobs) {
    if (!job || job.status !== "complete" || !job.completedAt) continue;
    const day = store.lisbonDate(job.completedAt);
    const bucket = index.get(day);
    if (bucket) bucket.count += 1;
  }
  const total = series.reduce((sum, item) => sum + item.count, 0);
  const summary = chartSummary(series);
  return h("figure", { class: "dash-panel dash-chart-wrap" },
    h("figcaption", { class: "dash-chart-head" },
      h("h2", { class: "dash-chart-heading", text: "Completed, last 14 days" }),
      h("span", { class: "dash-count", text: String(total) })
    ),
    series.length ? chartSvg(series, today, summary) : h("p", { class: "dash-chart-fallback", text: "Dates are unavailable." }),
    h("ol", { class: "dash-readout", "aria-hidden": "true" },
      series.map((item) => h("li", { class: cx("dash-readout-item", item.date === today && "dash-readout-today") },
        h("span", { class: "dash-readout-day", text: dayLabel(item.date) }),
        h("span", { class: "dash-readout-num", text: String(item.count) })
      ))
    )
  );
}

function chartSummary(series) {
  const total = series.reduce((sum, item) => sum + item.count, 0);
  const parts = series.map((item) => `${dayLabel(item.date)} ${item.count}`).join(", ");
  return `Bar chart of jobs completed per day for the last 14 days. ${parts}. Total ${total}.`;
}

function chartSvg(series, today, summary) {
  const vbW = 640;
  const vbH = 248;
  const padL = 8;
  const padR = 8;
  const padT = 28;
  const padB = 32;
  const innerW = vbW - padL - padR;
  const innerH = vbH - padT - padB;
  const gap = 8;
  const barW = (innerW - gap * (series.length - 1)) / series.length;
  const max = niceMax(Math.max(0, ...series.map((item) => item.count)));
  const svg = svgEl("svg", {
    class: "dash-chart",
    viewBox: `0 0 ${vbW} ${vbH}`,
    role: "img",
    "aria-label": summary,
    preserveAspectRatio: "xMidYMid meet",
    focusable: "false"
  });
  const title = svgEl("title");
  title.textContent = summary;
  svg.appendChild(title);

  const ticks = max <= 4
    ? Array.from({ length: max + 1 }, (_, i) => i)
    : [0, max / 4, max / 2, (max * 3) / 4, max];
  for (const tick of ticks) {
    const y = padT + innerH - (tick / max) * innerH;
    svg.appendChild(svgEl("line", {
      x1: padL,
      x2: vbW - padR,
      y1: y,
      y2: y,
      class: tick === 0 ? "dash-chart-grid dash-chart-baseline" : "dash-chart-grid"
    }));
  }

  series.forEach((item, i) => {
    const hgt = item.count === 0 ? 2 : Math.max(2, (item.count / max) * innerH);
    const x = padL + i * (barW + gap);
    const y = padT + innerH - hgt;
    const radius = Math.min(6, hgt / 2);
    const rect = svgEl("rect", {
      x,
      y,
      width: barW,
      height: hgt,
      rx: radius,
      ry: radius,
      class: cx("dash-bar", item.count === 0 && "dash-bar-zero", item.date === today && "dash-bar-today")
    });
    rect.style.animationDelay = `${i * 40}ms`;
    svg.appendChild(rect);

    const value = svgEl("text", {
      x: x + barW / 2,
      y: Math.max(12, y - 6),
      "text-anchor": "middle",
      class: "dash-chart-value"
    });
    value.textContent = String(item.count);
    svg.appendChild(value);

    const label = svgEl("text", {
      x: x + barW / 2,
      y: vbH - 10,
      "text-anchor": "middle",
      class: cx("dash-chart-label", item.date === today && "dash-chart-today")
    });
    label.textContent = dayLabel(item.date);
    svg.appendChild(label);
  });
  return svg;
}

function leaderboard(h, ui, store, now, openMember) {
  const rows = (store.leaderboard(now) || []).filter((row) => row && row.member).slice(0, 10);
  const max = rows.reduce((best, row) => Math.max(best, num(row.done30)), 0);
  return h("section", { class: "dash-panel dash-board" },
    h("div", { class: "dash-board-head" },
      h("h2", { class: "dash-board-heading", text: "Leaderboard" }),
      h("p", { class: "dash-board-subhead", text: "Completed in 30 days" })
    ),
    rows.length
      ? h("ol", { class: "dash-board-list" }, rows.map((row, index) => boardRow(h, ui, store, row, index, max, openMember)))
      : ui.empty("No completions in the last 30 days.", "users")
  );
}

function rowMember(store, row) {
  const member = row.member;
  if (member && typeof member === "object" && member.id) return member;
  if (typeof member === "string") return store.member(member) || { id: member, name: member };
  return { id: "unknown", name: "Unknown" };
}

function boardRow(h, ui, store, row, index, max, openMember) {
  const member = rowMember(store, row);
  const done30 = num(row.done30);
  const done7 = num(row.done7);
  const pct = max > 0 ? Math.round((done30 / max) * 100) : 0;
  const fill = h("span", { class: "dash-board-fill" });
  fill.style.width = `${pct}%`;
  fill.style.animationDelay = `${index * 45}ms`;
  return h("li", { class: "dash-board-row" },
    h("span", { class: "dash-rank" },
      h("span", { class: "dash-sr", text: "Rank " }),
      String(index + 1)
    ),
    h("button", {
      type: "button",
      class: "dash-board-person",
      "data-member": member.id,
      on: { click: () => openMember(member.id) }
    },
      h("span", { class: "dash-board-av", "aria-hidden": "true" }, ui.avatar(member, { size: "sm", ring: true })),
      h("span", { class: "dash-board-name", text: displayName(member) })
    ),
    h("span", { class: "dash-board-nums" },
      h("span", { class: "dash-board-num" },
        h("span", { text: String(done30) }),
        h("span", { class: "dash-sr", text: " in 30 days" })
      ),
      h("span", { class: "dash-board-sub", text: `${done7} in 7d` })
    ),
    h("span", { class: "dash-board-track", "aria-hidden": "true" }, fill)
  );
}

function automationsPanel(h, ui, store, now, go) {
  const stats = automationSnapshot(store, now);
  return h("section", { class: "dash-panel dash-auto" },
    h("div", { class: "dash-panel-head" },
      h("h2", { class: "dash-panel-title", text: "Automations" })
    ),
    autoKpis(h, stats),
    autoBlock(h, ui, store, go, "Failing", stats.failing, "failing", "Nothing failing."),
    autoBlock(h, ui, store, go, "Next runs", stats.upcoming, "upcoming", "No upcoming runs.")
  );
}

function automationSnapshot(store, now) {
  const empty = {
    total: 0,
    byStatus: { active: 0, failing: 0, paused: 0, draft: 0 },
    failing: [],
    upcoming: []
  };
  if (typeof store.automationStats !== "function") return empty;
  try {
    const stats = store.automationStats(now);
    if (!stats || typeof stats !== "object") return empty;
    const by = stats.byStatus && typeof stats.byStatus === "object" ? stats.byStatus : {};
    return {
      total: num(stats.total),
      byStatus: {
        active: num(by.active),
        failing: num(by.failing),
        paused: num(by.paused),
        draft: num(by.draft)
      },
      failing: asAutos(stats.failing),
      upcoming: asAutos(stats.upcoming)
    };
  } catch {
    return empty;
  }
}

function asAutos(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((auto) => auto && typeof auto === "object");
}

function autoKpis(h, stats) {
  const by = stats.byStatus || {};
  const items = [
    ["active", "Active", by.active],
    ["failing", "Failing", by.failing],
    ["draft", "Draft", by.draft]
  ];
  return h("div", { class: "dash-auto-kpis", role: "group", "aria-label": "Automation totals" },
    items.map(([tone, label, value]) => h("span", { class: "dash-auto-kpi", "data-tone": tone },
      h("span", { class: "dash-auto-dot", "aria-hidden": "true" }),
      h("span", { class: "dash-auto-kpi-num", text: String(num(value)) }),
      h("span", { class: "dash-auto-kpi-label", text: label })
    ))
  );
}

function autoBlock(h, ui, store, go, label, items, kind, emptyText) {
  return h("div", { class: "dash-auto-block" },
    h("h3", { class: "dash-auto-label", text: label }),
    items.length
      ? h("ul", { class: "dash-auto-list", role: "list", "aria-label": label },
        items.map((auto) => dashAutoRow(h, ui, store, auto, go, kind))
      )
      : h("p", { class: "dash-auto-empty", text: emptyText })
  );
}

function dashAutoRow(h, ui, store, auto, go, kind) {
  const person = crewMember(store, auto.memberId);
  const stamp = runStamp(store, kind === "upcoming" ? auto.nextRunAt : auto.lastRunAt);
  const name = typeof auto.name === "string" ? auto.name.trim() : "";
  const whenLabel = kind === "upcoming" ? "Next run " : "Last run ";
  const time = stamp.iso
    ? h("time", { class: "dash-auto-time", datetime: stamp.iso },
      h("span", { class: "dash-auto-sr", text: whenLabel }),
      stamp.text
    )
    : h("span", { class: "dash-auto-time" },
      h("span", { class: "dash-auto-sr", text: whenLabel }),
      stamp.text
    );
  return h("li", { role: "listitem" },
    h("button", {
      type: "button",
      class: "dash-auto-row",
      "data-kind": kind,
      on: { click: () => openMemberAutomations(go, auto.memberId) }
    },
      h("span", { class: "dash-auto-av", "aria-hidden": "true" }, ui.avatar(person, { size: "xs", ring: true })),
      h("span", { class: "dash-auto-body" },
        h("span", { class: "dash-auto-name", text: displayName(person) }),
        h("span", { class: "dash-auto-meta" },
          name ? h("span", { class: "dash-auto-sub", text: name }) : null,
          time
        )
      )
    )
  );
}

function crewMember(store, id) {
  if (!id) return { id: "", name: "Unknown" };
  const found = typeof store.member === "function" ? store.member(id) : null;
  if (found && typeof found === "object") return found;
  return { id: String(id), name: String(id) };
}

function runStamp(store, iso) {
  if (!iso || typeof store.fmtDateTime !== "function") return { text: "-", iso: "" };
  try {
    const text = store.fmtDateTime(iso);
    return text ? { text: String(text), iso: String(iso) } : { text: "-", iso: "" };
  } catch {
    return { text: "-", iso: "" };
  }
}

function openMemberAutomations(go, memberId) {
  if (typeof go !== "function") return;
  const id = memberId == null ? "" : String(memberId).trim();
  go({ view: "automations", member: id || null });
}

function jobPanel(h, ui, store, title, jobs, now, openJob, emptyText, iconName) {
  return h("section", { class: "dash-panel" },
    h("div", { class: "dash-panel-head" },
      h("h2", { class: "dash-panel-title", text: title }),
      h("span", { class: "dash-count", text: String(jobs.length) })
    ),
    jobs.length
      ? h("ul", { class: "dash-jobs" }, jobs.map((job) => dashJob(h, ui, store, job, now, openJob)))
      : ui.empty(emptyText, iconName)
  );
}

function byUpdatedDesc(a, b) {
  return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
}

function byDueAsc(a, b) {
  const ad = isYmd(a.due) ? a.due : "9999-99-99";
  const bd = isYmd(b.due) ? b.due : "9999-99-99";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return byUpdatedDesc(a, b);
}

function jobWhen(store, job, now) {
  if (isYmd(job.due)) {
    return { text: `Due ${store.fmtDate(job.due)}`, late: !!store.isOverdue(job, now) };
  }
  if (job.updatedAt) return { text: `Updated ${store.fmtDate(job.updatedAt)}`, late: false };
  return { text: "", late: false };
}

function dashJob(h, ui, store, job, now, openJob) {
  const when = jobWhen(store, job, now);
  const leadName = job.lead ? (store.member(job.lead)?.name || job.lead) : "Unassigned";
  return h("li", {},
    h("button", {
      type: "button",
      class: "dash-job",
      on: { click: () => openJob(job.id) }
    },
      h("span", { class: "dash-sr", text: `Lead ${leadName}. ` }),
      h("span", { class: "dash-job-av", "aria-hidden": "true" }, ui.avatar(job.lead || "?", { size: "sm", ring: true })),
      h("span", { class: "dash-job-body" },
        h("span", { class: "dash-job-title", text: job.title || "Untitled job" }),
        when.text ? h("span", { class: cx("dash-job-meta", when.late && "dash-late"), text: when.text }) : null
      ),
      h("span", { class: "dash-job-go", "aria-hidden": "true" }, ui.icon("arrow-right", { size: 16 }))
    )
  );
}
