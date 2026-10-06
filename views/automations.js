const FALLBACK_STATUSES = ["active", "failing", "paused", "draft"];
const FALLBACK_STATUS_LABEL = {
  active: "Active",
  failing: "Failing",
  paused: "Paused",
  draft: "Draft"
};
const DIVISIONS = ["command", "ops", "career", "health", "brand"];
const CHANNEL_LABEL = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "Email",
  github: "GitHub",
  calendar: "Calendar",
  app: "App"
};
const HOUR = 60 * 60 * 1000;

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function isRecord(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function clean(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function param(params, key) {
  if (!params || typeof params.get !== "function") return "";
  const value = params.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nowOf(ctx) {
  return ctx && ctx.now instanceof Date && !Number.isNaN(ctx.now.getTime()) ? ctx.now : new Date();
}

function call(fn, fallback, ...args) {
  if (typeof fn !== "function") return fallback;
  try {
    const value = fn(...args);
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

function statusesOf(store) {
  const list = store && Array.isArray(store.AUTOMATION_STATUSES) ? store.AUTOMATION_STATUSES : null;
  const known = (list || []).filter((status) => typeof status === "string" && status);
  return known.length ? known : FALLBACK_STATUSES.slice();
}

function statusLabel(store, status) {
  const labels = (store && store.AUTOMATION_STATUS_LABEL) || FALLBACK_STATUS_LABEL;
  return labels[status] || FALLBACK_STATUS_LABEL[status] || status || "Unknown";
}

function displayName(member) {
  return member?.name || member?.id || "Unassigned";
}

function divisionId(value) {
  return DIVISIONS.includes(value) ? value : "";
}

function safeStatus(status) {
  return FALLBACK_STATUSES.includes(status) ? status : "";
}

function domId(prefix, value, index) {
  const slug = String(value || "x").replace(/[^A-Za-z0-9_-]/g, "") || "x";
  return `${prefix}-${slug}-${index}`;
}

function isChanged(store, id) {
  const changed = store && store.state && store.state.changedIds;
  if (!id || changed == null) return false;
  if (typeof changed.has === "function") return changed.has(id);
  return Array.isArray(changed) && changed.includes(id);
}

function parseTime(value) {
  const text = clean(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSoon(auto, now) {
  if (!auto || auto.status !== "active") return false;
  const date = parseTime(auto.nextRunAt);
  if (!date) return false;
  const delta = date.getTime() - now.getTime();
  return delta >= 0 && delta <= HOUR;
}

function cueText(auto) {
  const trigger = clean(auto && auto.trigger);
  const schedule = clean(auto && auto.schedule);
  const event = clean(auto && auto.event);
  if (trigger === "event") return event || "Event";
  if (trigger === "manual") return "Manual";
  if (trigger === "schedule") return schedule || "Schedule";
  if (schedule) return schedule;
  if (event) return event;
  return "Manual";
}

function channelLabel(value) {
  const text = clean(value);
  if (!text) return "";
  return CHANNEL_LABEL[text.toLowerCase()] || text;
}

function resultKey(result) {
  return result === "ok" || result === "error" || result === "skipped" ? result : "";
}

function resultLabel(result) {
  if (result === "ok") return "OK";
  if (result === "error") return "Error";
  if (result === "skipped") return "Skipped";
  return "No result";
}

function stamp(store, iso) {
  const label = call(store && store.fmtDateTime, "", iso);
  return typeof label === "string" && label ? label : "-";
}

function relative(store, iso, now) {
  const label = call(store && store.relTime, "", iso, now);
  return typeof label === "string" ? label : "";
}

function scopedAutomations(store, params) {
  const filters = {};
  const q = param(params, "q");
  const member = param(params, "member");
  const division = param(params, "division");
  if (q) filters.q = q;
  if (member) filters.member = member;
  if (division) filters.division = division;
  const list = call(store && store.filterAutomations, null, filters);
  if (Array.isArray(list)) return list.filter(isRecord);
  const all = call(store && store.automations, []);
  return Array.isArray(all) ? all.filter(isRecord) : [];
}

function visibleAutomations(ctx, pool, selected) {
  if (Array.isArray(ctx && ctx.automations)) return ctx.automations.filter(isRecord);
  if (!selected) return pool;
  return pool.filter((auto) => auto.status === selected);
}

function countStatuses(list, statuses) {
  const counts = new Map(statuses.map((status) => [status, 0]));
  for (const auto of list) {
    const status = clean(auto.status);
    if (counts.has(status)) counts.set(status, counts.get(status) + 1);
  }
  return counts;
}

function memberRecord(store, id) {
  const found = id ? call(store && store.member, null, id) : null;
  if (isRecord(found)) return found;
  return { id: id || "", name: id || "Unassigned", title: "", division: "" };
}

function groupAutomations(store, list) {
  const members = call(store && store.members, []);
  const roster = Array.isArray(members) ? members.filter((member) => isRecord(member) && member.id) : [];
  const buckets = new Map(roster.map((member) => [member.id, { member, items: [] }]));
  const orphans = [];
  for (const auto of list) {
    const id = clean(auto.memberId);
    if (id && buckets.has(id)) buckets.get(id).items.push(auto);
    else orphans.push(auto);
  }
  const groups = [];
  for (const member of roster) {
    const bucket = buckets.get(member.id);
    if (bucket && bucket.items.length) groups.push(bucket);
  }
  const extra = new Map();
  for (const auto of orphans) {
    const id = clean(auto.memberId);
    if (!extra.has(id)) extra.set(id, { member: memberRecord(store, id), items: [] });
    extra.get(id).items.push(auto);
  }
  for (const group of extra.values()) groups.push(group);
  return groups;
}

function runsOf(store, auto) {
  const list = call(store && store.automationRuns, null, auto);
  if (Array.isArray(list)) return list.filter(isRecord);
  const runs = Array.isArray(auto && auto.runs) ? auto.runs.filter(isRecord) : [];
  return runs.slice().reverse();
}

function jobOf(store, jobId) {
  const id = clean(jobId);
  if (!id) return null;
  const job = call(store && store.jobById, null, id);
  return isRecord(job) ? job : null;
}

function statusFilters(h, go, store, statuses, counts, total, selected) {
  const chips = [
    filterChip(h, go, {
      id: "",
      label: "All",
      count: total,
      pressed: selected === ""
    })
  ];
  for (const status of statuses) {
    chips.push(filterChip(h, go, {
      id: status,
      label: statusLabel(store, status),
      count: counts.get(status) || 0,
      pressed: selected === status
    }));
  }
  return h("div", { class: "auto-filters", role: "group", "aria-label": "Filter by status" }, chips);
}

function filterChip(h, go, { id, label, count, pressed }) {
  const known = safeStatus(id);
  return h("button", {
    type: "button",
    class: cx("auto-chip", known && `auto-chip-${known}`),
    "aria-pressed": pressed ? "true" : "false",
    on: {
      click: () => {
        if (typeof go === "function") go({ astatus: id || null });
      }
    }
  },
    known ? h("span", { class: "auto-chip-dot", "aria-hidden": "true" }) : null,
    h("span", { class: "auto-chip-label", text: label }),
    h("span", { class: "auto-chip-count", text: String(count) })
  );
}

function summaryLine(h, total, active, failing) {
  const noun = total === 1 ? "automation" : "automations";
  return h("p", { class: "auto-summary" },
    `${total} ${noun} · ${active} active · `,
    h("span", {
      class: failing ? "auto-summary-bad" : "auto-summary-quiet",
      text: `${failing} failing`
    })
  );
}

function emptyCopy(selected, poolCount, allCount) {
  if (poolCount > 0 && selected) return "No automations with this status.";
  if (allCount > 0) return "No automations match.";
  return "No automations yet.";
}

function memberHeader(h, ui, member, count, index, openMember) {
  const id = clean(member && member.id);
  const division = divisionId(member && member.division);
  const headingId = domId("auto-member", id || "none", index);
  const badge = division && typeof ui.divisionBadge === "function" ? ui.divisionBadge(division) : null;
  const avatar = typeof ui.avatar === "function"
    ? h("span", { class: "auto-member-avatar", "aria-hidden": "true" }, ui.avatar(member, { size: "md", ring: true }))
    : null;
  const body = [
    avatar,
    h("span", { class: "auto-member-copy" },
      h("h2", { class: "auto-member-name", id: headingId, text: displayName(member) }),
      clean(member && member.title)
        ? h("span", { class: "auto-member-title", text: clean(member.title) })
        : null
    ),
    h("span", { class: "auto-member-side" },
      badge,
      h("span", { class: "auto-member-count" },
        h("span", { text: String(count) }),
        h("span", { class: "auto-sr", text: count === 1 ? " automation" : " automations" })
      )
    )
  ];
  if (!id || typeof openMember !== "function") {
    const props = { class: "auto-member auto-member-static" };
    if (division) props["data-division"] = division;
    return h("div", props, body);
  }
  const props = {
    type: "button",
    class: "auto-member",
    on: { click: () => openMember(id) }
  };
  if (division) props["data-division"] = division;
  return h("button", props, body);
}

function triggerMark(ui, trigger) {
  if (typeof ui.triggerIcon === "function") return ui.triggerIcon(trigger);
  const name = trigger === "event" ? "zap" : trigger === "manual" ? "play" : "clock";
  return typeof ui.icon === "function" ? ui.icon(name, { size: 16 }) : null;
}

function statusMark(h, ui, status) {
  const known = safeStatus(status);
  const chip = typeof ui.autoStatusChip === "function"
    ? ui.autoStatusChip(status || "")
    : h("span", { class: "chip chip-auto", text: statusLabel(null, status) });
  return h("span", { class: cx("auto-status", known && `auto-status-${known}`) }, chip);
}

function soonMark(h) {
  return h("span", { class: "auto-soon", title: "Next run within the hour" },
    h("span", { class: "auto-pulse", "aria-hidden": "true" }),
    h("span", { class: "auto-sr", text: "Next run within the hour" })
  );
}

function resultDot(h, result) {
  const key = resultKey(result);
  return h("span", {
    class: cx("auto-dot", key && `auto-dot-${key}`),
    "aria-hidden": "true"
  });
}

function lastRun(h, store, auto, now) {
  const at = clean(auto.lastRunAt);
  const result = clean(auto.lastResult);
  if (!at && !result) {
    return h("span", { class: "auto-time-v auto-never", text: "Never run" });
  }
  const rel = at ? relative(store, at, now) : "";
  return h("span", { class: "auto-time-v" },
    resultDot(h, result),
    h("span", { class: "auto-sr", text: `${resultLabel(result)}. ` }),
    h("span", { text: rel || stamp(store, at) })
  );
}

function nextRun(h, store, auto) {
  const at = clean(auto.nextRunAt);
  return h("span", { class: "auto-time-v", text: at ? stamp(store, at) : "-" });
}

function jobButton(h, store, openJob, jobId) {
  const job = jobOf(store, jobId);
  if (!job || typeof openJob !== "function") return null;
  const title = clean(job.title) || "Open job";
  const id = clean(job.id) || clean(jobId);
  return h("button", {
    type: "button",
    class: "auto-job",
    title: title,
    on: { click: () => openJob(id) }
  }, title);
}

function runRow(h, store, openJob, run) {
  const at = clean(run.at);
  const text = clean(run.text);
  const result = clean(run.result);
  const timeProps = { class: "auto-run-time", text: stamp(store, at) };
  if (at) timeProps.dateTime = at;
  return h("li", { class: "auto-run" },
    resultDot(h, result),
    h("div", { class: "auto-run-body" },
      h("div", { class: "auto-run-meta" },
        h("span", { class: "auto-sr", text: `${resultLabel(result)}. ` }),
        h("time", timeProps)
      ),
      text ? h("p", { class: "auto-run-text", text }) : null,
      jobButton(h, store, openJob, run.jobId)
    )
  );
}

function history(h, ui, store, openJob, auto) {
  const runs = runsOf(store, auto);
  const count = runs.length;
  const clip = h("div", { class: "auto-runs-clip" },
    count
      ? h("ol", { class: "auto-runlist" }, runs.map((run) => runRow(h, store, openJob, run)))
      : h("p", { class: "auto-run-none", text: "No runs yet." })
  );
  const panel = h("div", { class: "auto-runs" }, clip);
  let details;
  const sync = () => {
    if (!details) return;
    if (details.open) clip.removeAttribute("inert");
    else clip.setAttribute("inert", "");
  };
  const chevron = typeof ui.icon === "function"
    ? h("span", { class: "auto-chevron", "aria-hidden": "true" }, ui.icon("chevron-right", { size: 16 }))
    : null;
  details = h("details", { class: "auto-history", on: { toggle: sync } },
    h("summary", { class: "auto-history-sum" },
      chevron,
      h("span", { text: `Run history (${count})` })
    ),
    panel
  );
  sync();
  return details;
}

function automationCard(h, ui, store, ctx, auto, now) {
  const status = clean(auto.status);
  const known = safeStatus(status);
  const division = divisionId(ctx && ctx.division);
  const soon = isSoon(auto, now);
  const channel = channelLabel(auto.channel);
  const action = clean(auto.action);
  const name = clean(auto.name) || "Untitled automation";
  const props = {
    class: cx(
      "auto-card",
      known === "failing" && "auto-card-fail",
      known === "draft" && "auto-card-draft",
      soon && "auto-card-soon",
      isChanged(store, clean(auto.id)) && "flash"
    )
  };
  if (known) props["data-status"] = known;
  if (division) props["data-division"] = division;
  const id = clean(auto.id);
  if (id) props["data-auto-id"] = id;

  return h("article", props,
    h("div", { class: "auto-card-top" },
      h("span", { class: "auto-trigger", "aria-hidden": "true" }, triggerMark(ui, clean(auto.trigger))),
      h("h3", { class: "auto-name", text: name }),
      soon ? soonMark(h) : null,
      statusMark(h, ui, status)
    ),
    h("div", { class: "auto-whenrow" },
      h("p", { class: "auto-when", text: cueText(auto) }),
      channel ? h("span", { class: "auto-channel", text: channel }) : null
    ),
    action ? h("p", { class: "auto-action", text: action }) : null,
    h("div", { class: "auto-times" },
      h("div", { class: "auto-time" },
        h("span", { class: "auto-time-k", text: "Last run" }),
        lastRun(h, store, auto, now)
      ),
      h("div", { class: "auto-time" },
        h("span", { class: "auto-time-k", text: "Next run" }),
        nextRun(h, store, auto)
      )
    ),
    h("div", { class: "auto-foot" },
      known === "draft"
        ? h("p", { class: "auto-draftnote", text: "Draft - waiting for Grok to confirm" })
        : null,
      history(h, ui, store, ctx.openJob, auto)
    )
  );
}

function memberGroup(h, ui, store, ctx, group, index, now) {
  const member = group.member;
  const division = divisionId(member && member.division);
  const headingId = domId("auto-member", clean(member && member.id) || "none", index);
  const props = { class: "auto-group", "aria-labelledby": headingId };
  if (division) props["data-division"] = division;
  const cardCtx = { division, openJob: ctx.openJob };
  return h("section", props,
    memberHeader(h, ui, member, group.items.length, index, ctx.openMember),
    h("ul", { class: "auto-grid" }, group.items.map((auto) =>
      h("li", { class: "auto-item" }, automationCard(h, ui, store, cardCtx, auto, now))
    ))
  );
}

export function render(root, ctx) {
  const safe = ctx || {};
  const { store, ui, params, go, openMember, openJob } = safe;
  const h = ui && ui.h;
  if (!root || typeof root.append !== "function" || typeof h !== "function") return;

  const now = nowOf(safe);
  const statuses = statusesOf(store);
  const requested = param(params, "astatus");
  const selected = statuses.includes(requested) ? requested : "";
  const pool = store ? scopedAutomations(store, params) : [];
  const counts = countStatuses(pool, statuses);
  const shown = visibleAutomations(safe, pool, selected);
  const all = call(store && store.automations, null);
  const allCount = Array.isArray(all) ? all.filter(isRecord).length : pool.length;
  const groups = store ? groupAutomations(store, shown) : [];

  if (typeof ui.clear === "function") ui.clear(root);
  else if (typeof root.replaceChildren === "function") root.replaceChildren();

  root.append(h("div", { class: "auto" },
    h("div", { class: "auto-head" },
      statusFilters(h, go, store, statuses, counts, pool.length, selected),
      summaryLine(h, pool.length, counts.get("active") || 0, counts.get("failing") || 0)
    ),
    shown.length
      ? h("div", { class: "auto-groups" }, groups.map((group, index) =>
        memberGroup(h, ui, store, { openMember, openJob }, group, index, now)
      ))
      : (typeof ui.empty === "function"
        ? ui.empty(emptyCopy(selected, pool.length, allCount), "bot")
        : h("p", { class: "auto-summary", text: emptyCopy(selected, pool.length, allCount) }))
  ));
}
