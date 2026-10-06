const DOW = [
  ["Mon", "Monday"],
  ["Tue", "Tuesday"],
  ["Wed", "Wednesday"],
  ["Thu", "Thursday"],
  ["Fri", "Friday"],
  ["Sat", "Saturday"],
  ["Sun", "Sunday"]
];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function isYmd(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function ymdOf(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftMonth(ym, delta) {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseMonth(value, fallback) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return fallback;
  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12) return fallback;
  return value;
}

function mondayIndex(year, month, day) {
  const sun0 = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sun0 + 6) % 7;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthTitle(ym) {
  const [year, month] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function longDate(ymd) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function weekdayIndex(ymd) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function monthCells(ym) {
  const [year, month] = ym.split("-").map(Number);
  const count = daysInMonth(year, month);
  const lead = mondayIndex(year, month, 1);
  const cells = [];
  const [py, pm] = shiftMonth(ym, -1).split("-").map(Number);
  const prevCount = daysInMonth(py, pm);
  for (let i = 0; i < lead; i++) {
    cells.push({ ymd: ymdOf(py, pm, prevCount - lead + 1 + i), inMonth: false });
  }
  for (let day = 1; day <= count; day++) cells.push({ ymd: ymdOf(year, month, day), inMonth: true });
  const [ny, nm] = shiftMonth(ym, 1).split("-").map(Number);
  let day = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ ymd: ymdOf(ny, nm, day), inMonth: false });
    day += 1;
  }
  return cells;
}

export function render(root, ctx) {
  const { store, ui, params, jobs, now, go, openJob } = ctx;
  const { h } = ui;
  const today = store.todayLisbon(now);
  const todayMonth = isYmd(today) ? today.slice(0, 7) : fallbackMonth(now);
  const month = parseMonth(params.get("month"), todayMonth);
  const cells = monthCells(month);
  const byDay = indexJobs(Array.isArray(jobs) ? jobs : [], store);
  const title = monthTitle(month);

  root.append(h("div", { class: "cal" },
    h("div", { class: "cal-head" },
      h("h2", { class: "cal-title", text: title }),
      h("div", { class: "cal-nav", role: "group", "aria-label": "Change month" },
        navButton(h, ui, "chevron-left", "Previous month", () => go({ month: shiftMonth(month, -1) })),
        h("button", {
          type: "button",
          class: "cal-nav-btn",
          "aria-pressed": month === todayMonth ? "true" : "false",
          on: { click: () => go({ month: todayMonth }) }
        }, "Today"),
        navButton(h, ui, "chevron-right", "Next month", () => go({ month: shiftMonth(month, 1) }))
      )
    ),
    h("div", { class: "cal-grid-wrap" }, monthGrid(h, ui, store, openJob, now, today, title, cells, byDay)),
    h("div", { class: "cal-agenda" }, agenda(h, ui, store, openJob, now, today, cells, byDay)),
    legend(h)
  ));
}

function fallbackMonth(now) {
  const date = now instanceof Date ? now : new Date();
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
  return formatted.slice(0, 7);
}

function navButton(h, ui, iconName, label, onClick) {
  return h("button", {
    type: "button",
    class: "cal-nav-btn",
    "aria-label": label,
    on: { click: onClick }
  }, h("span", { "aria-hidden": "true" }, ui.icon(iconName, { size: 18 })));
}

function indexJobs(jobs, store) {
  const map = new Map();
  const add = (ymd, item) => {
    if (!isYmd(ymd)) return;
    if (!map.has(ymd)) map.set(ymd, []);
    map.get(ymd).push(item);
  };
  for (const job of jobs) {
    if (!job || !job.id) continue;
    const doneOn = job.completedAt ? store.lisbonDate(job.completedAt) : "";
    const dueOn = isYmd(job.due) ? job.due : "";
    if (isYmd(doneOn)) add(doneOn, { job, kind: "done" });
    if (dueOn && dueOn !== doneOn) add(dueOn, { job, kind: "due" });
  }
  return map;
}

function sortItems(items, store, now) {
  return items.slice().sort((a, b) => {
    const aOver = a.kind === "due" && store.isOverdue(a.job, now) ? 0 : 1;
    const bOver = b.kind === "due" && store.isOverdue(b.job, now) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    if (a.kind !== b.kind) return a.kind === "due" ? -1 : 1;
    const aRank = PRIORITY_RANK[a.job.priority] ?? 4;
    const bRank = PRIORITY_RANK[b.job.priority] ?? 4;
    if (aRank !== bRank) return aRank - bRank;
    return String(a.job.title || "").localeCompare(String(b.job.title || ""));
  });
}

function monthGrid(h, ui, store, openJob, now, today, title, cells, byDay) {
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return h("div", { class: "cal-grid", role: "grid", "aria-label": title },
    h("div", { class: "cal-row", role: "row" },
      DOW.map(([short, long]) => h("div", {
        role: "columnheader",
        class: "cal-dow",
        title: long,
        text: short
      }))
    ),
    weeks.map((week) => h("div", { class: "cal-row", role: "row" },
      week.map((info) => dayCell(h, ui, store, openJob, now, today, info, byDay.get(info.ymd) || []))
    ))
  );
}

function dayCell(h, ui, store, openJob, now, today, info, items) {
  const isToday = info.ymd === today;
  const props = {
    class: cx("cal-cell", !info.inMonth && "cal-out", isToday && "cal-today"),
    role: "gridcell",
    "data-ymd": info.ymd
  };
  if (isToday) props["aria-current"] = "date";
  const label = longDate(info.ymd);
  props["aria-label"] = info.inMonth ? label : `${label}, outside this month`;
  const dayNum = String(Number(info.ymd.slice(8, 10)));
  return h("div", props,
    h("span", { class: "cal-daynum", text: dayNum }),
    pillNodes(h, ui, store, openJob, now, items, 3)
  );
}

function agenda(h, ui, store, openJob, now, today, cells, byDay) {
  const days = cells.filter((cell) => cell.inMonth && (byDay.get(cell.ymd) || []).length);
  if (!days.length) return ui.empty("Nothing scheduled this month.", "calendar");
  return days.map((cell) => {
    const isToday = cell.ymd === today;
    const wd = WEEKDAY_SHORT[weekdayIndex(cell.ymd)];
    const heading = `${wd} ${store.fmtDate(cell.ymd)}${isToday ? " · Today" : ""}`;
    return h("section", { class: "cal-dayblock" },
      h("h3", { class: cx("cal-daytitle", isToday && "cal-today-label"), text: heading }),
      h("ul", { class: "cal-daylist" },
        sortItems(byDay.get(cell.ymd), store, now).map((item) => h("li", {},
          pill(h, ui, store, item, now, openJob)
        ))
      )
    );
  });
}

function pillNodes(h, ui, store, openJob, now, items, limit) {
  const sorted = sortItems(items, store, now);
  if (!limit || sorted.length <= limit) return sorted.map((item) => pill(h, ui, store, item, now, openJob));
  const extra = sorted.slice(limit);
  return [
    ...sorted.slice(0, limit).map((item) => pill(h, ui, store, item, now, openJob)),
    h("details", { class: "cal-extra" },
      h("summary", { class: "cal-more", text: `+${extra.length} more` }),
      extra.map((item) => pill(h, ui, store, item, now, openJob))
    )
  ];
}

function pill(h, ui, store, item, now, openJob) {
  const { job, kind } = item;
  const overdue = kind === "due" && !!store.isOverdue(job, now);
  return h("button", {
    type: "button",
    class: cx("cal-pill", kind === "done" ? "cal-pill-done" : "cal-pill-due", overdue && "cal-overdue"),
    "data-priority": job.priority || "",
    "data-kind": kind,
    title: job.title || "Job",
    on: { click: () => openJob(job.id) }
  },
    kind === "done"
      ? h("span", { class: "cal-pill-icon", "aria-hidden": "true" }, ui.icon("check", { size: 12 }))
      : null,
    h("span", { class: "cal-pill-text", text: job.title || "Untitled job" })
  );
}

function legend(h) {
  const items = [
    ["cal-swatch-due", "Due"],
    ["cal-swatch-done", "Completed"],
    ["cal-swatch-overdue", "Overdue"],
    ["cal-swatch-today", "Today"]
  ];
  return h("ul", { class: "cal-legend" },
    items.map(([swatch, label]) => h("li", { class: "cal-legend-item" },
      h("span", { class: cx("cal-swatch", swatch), "aria-hidden": "true" }),
      h("span", { text: label })
    ))
  );
}
