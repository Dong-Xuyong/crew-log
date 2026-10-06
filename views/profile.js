const OPEN_STATUS = new Set(["todo", "in_progress", "blocked", "review"]);

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
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function fmtAvg(hours) {
  if (hours == null || hours === "") return "-";
  const n = Number(hours);
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n >= 24) return `${(n / 24).toFixed(1)}d`;
  return `${n.toFixed(1)}h`;
}

function personOf(store, id) {
  if (!id) return null;
  if (typeof id === "object") return id.id ? id : null;
  return store.member(id) || { id, name: id };
}

export function render(root, ctx) {
  const { store, ui, params, now, go, openJob, openMember } = ctx;
  const { h } = ui;
  const id = params.get("m");
  const member = id ? store.member(id) : undefined;
  if (!member) {
    root.append(h("div", { class: "profile" },
      backButton(h, ui, go),
      ui.empty(id ? "This crew member isn't on the log." : "No crew member selected.", "user")
    ));
    return;
  }

  const stats = store.memberStats(member.id, now) || {};
  const openJobs = jobsForMember(store, member.id);
  root.append(h("div", { class: "profile" },
    backButton(h, ui, go),
    hero(h, ui, store, member, openMember),
    statTiles(h, stats),
    openSection(h, ui, store, openJobs, now, openJob),
    timeline(h, ui, store, member, openJob)
  ));
}

function backButton(h, ui, go) {
  return h("button", {
    type: "button",
    class: "profile-back",
    on: { click: () => go({ view: "members", m: null }) }
  },
    h("span", { class: "profile-back-icon", "aria-hidden": "true" }, ui.icon("chevron-left", { size: 18 })),
    "Members"
  );
}

function hero(h, ui, store, member, openMember) {
  const paused = member.status === "paused";
  const oneJob = String(member.oneJob || "").trim();
  const reports = (store.directReports(member.id) || []).map((item) => personOf(store, item)).filter(Boolean);
  return h("article", { class: cx("profile-hero", paused && "profile-paused"), "data-division": member.division || "" },
    h("div", { class: "profile-avatar", "aria-hidden": "true" }, ui.avatar(member, { size: "xl", ring: true })),
    h("div", { class: "profile-id" },
      h("h2", { class: "profile-name", text: displayName(member) }),
      member.title ? h("p", { class: "profile-title", text: member.title }) : null,
      h("div", { class: "profile-meta" },
        member.division ? ui.divisionBadge(member.division) : null,
        statusChip(h, member.status),
        member.joinedAt ? h("span", { class: "profile-joined", text: `Joined ${store.fmtDate(member.joinedAt)}` }) : null
      ),
      member.description ? h("p", { class: "profile-bio", text: member.description }) : null
    ),
    h("div", { class: "profile-onejob" },
      h("span", { class: "profile-onejob-label", text: "ONE JOB" }),
      oneJob
        ? h("p", { class: "profile-onejob-text", text: oneJob })
        : h("p", { class: "profile-onejob-text profile-empty", text: "Not set yet" })
    ),
    h("div", { class: "profile-links" },
      bossBlock(h, ui, store, member, openMember),
      h("div", { class: "profile-people" },
        h("span", { class: "profile-k", text: "Direct reports" }),
        reports.length
          ? h("div", { class: "profile-report-row" }, reports.map((person) => personButton(h, ui, person, openMember)))
          : h("p", { class: "profile-none", text: "No direct reports" })
      )
    )
  );
}

function statusChip(h, status) {
  if (!status) return null;
  const paused = status === "paused";
  const active = status === "active";
  const label = paused ? "Paused" : active ? "Active" : String(status);
  return h("span", { class: cx("profile-status", paused && "profile-paused", active && "profile-active"), text: label });
}

function bossBlock(h, ui, store, member, openMember) {
  if (!member.reportsTo) {
    return h("div", { class: "profile-people" },
      h("span", { class: "profile-k", text: "Reports to" }),
      h("p", { class: "profile-none", text: "Top of the crew" })
    );
  }
  const boss = personOf(store, member.reportsTo);
  return h("div", { class: "profile-people" },
    h("span", { class: "profile-k", text: "Reports to" }),
    personButton(h, ui, boss, openMember)
  );
}

function personButton(h, ui, member, openMember) {
  return h("button", {
    type: "button",
    class: "profile-person",
    "data-member": member.id,
    on: { click: () => openMember(member.id) }
  },
    h("span", { class: "profile-person-av", "aria-hidden": "true" }, ui.avatar(member, { size: "sm", ring: true })),
    h("span", { class: "profile-person-name", text: displayName(member) })
  );
}

function statTiles(h, stats) {
  const tiles = [
    ["Open", String(num(stats.open))],
    ["Done 7d", String(num(stats.done7))],
    ["Done 30d", String(num(stats.done30))],
    ["Avg completion", fmtAvg(stats.avgHours)]
  ];
  return h("div", { class: "profile-stats", role: "group", "aria-label": "Stats" },
    tiles.map(([label, value]) => h("div", { class: "profile-stat" },
      h("div", { class: "profile-stat-num", text: value }),
      h("div", { class: "profile-stat-label", text: label })
    ))
  );
}

function jobsForMember(store, id) {
  return (store.jobs() || []).filter((job) => {
    if (!job?.id || !OPEN_STATUS.has(job.status)) return false;
    if (job.lead === id) return true;
    return Array.isArray(job.assignees) && job.assignees.includes(id);
  }).slice().sort(compareJobs);
}

function compareJobs(a, b) {
  const ad = isYmd(a.due) ? a.due : "9999-99-99";
  const bd = isYmd(b.due) ? b.due : "9999-99-99";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return String(a.title || "").localeCompare(String(b.title || ""));
}

function openSection(h, ui, store, jobs, now, openJob) {
  return h("section", { class: "profile-section" },
    h("div", { class: "profile-section-head" },
      h("h2", { class: "profile-section-title", text: "Open jobs" }),
      h("span", { class: "profile-count", text: String(jobs.length) })
    ),
    jobs.length
      ? h("ul", { class: "profile-jobs" }, jobs.map((job) => jobRow(h, ui, store, job, now, openJob)))
      : ui.empty("No open jobs.", "check")
  );
}

function jobRow(h, ui, store, job, now, openJob) {
  const late = isYmd(job.due) && store.isOverdue(job, now);
  const due = isYmd(job.due) ? `Due ${store.fmtDate(job.due)}` : "";
  return h("li", {},
    h("button", {
      type: "button",
      class: "profile-job",
      on: { click: () => openJob(job.id) }
    },
      h("span", { class: "profile-job-title", text: job.title || "Untitled job" }),
      job.status ? ui.statusChip(job.status) : null,
      due ? h("span", { class: cx("profile-job-due", late && "profile-late"), text: due }) : null
    )
  );
}

function timeline(h, ui, store, member, openJob) {
  const groups = groupDays(store, member.id);
  return h("section", { class: "timeline" },
    h("h2", { class: "timeline-title", text: `Everything ${displayName(member)} logged` }),
    groups.length
      ? groups.map((group) => h("div", { class: "timeline-group" },
        h("h3", { class: "timeline-day", text: group.day ? store.fmtDate(group.day) : "Undated" }),
        h("ol", { class: "timeline-list" }, group.items.map((item) => timelineItem(h, ui, store, item, openJob)))
      ))
      : ui.empty("No log entries yet.", "message")
  );
}

function groupDays(store, id) {
  const groups = [];
  const index = new Map();
  for (const item of store.memberTimeline(id) || []) {
    const entry = item?.entry || {};
    const job = item?.job || {};
    const day = entry.at ? (store.lisbonDate(entry.at) || "") : "";
    const key = day || "undated";
    let group = index.get(key);
    if (!group) {
      group = { day, items: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.items.push({ job, entry });
  }
  return groups;
}

function timelineItem(h, ui, store, item, openJob) {
  const { job, entry } = item;
  const action = entry.action || "";
  const actionLabel = (store.ACTION_LABEL && store.ACTION_LABEL[action]) || action || "Log";
  const title = job.title || "Untitled job";
  const when = entry.at ? store.fmtTime(entry.at) : "";
  const timeProps = { class: "timeline-time", text: when };
  if (entry.at) timeProps.datetime = entry.at;
  return h("li", { class: "timeline-item" },
    h("div", { class: "timeline-mark", "aria-hidden": "true" }, ui.actionIcon(action)),
    h("div", { class: "timeline-body" },
      h("div", { class: "timeline-top" },
        h("span", { class: "timeline-action", "data-action": action, text: actionLabel }),
        job.id
          ? h("button", { type: "button", class: "timeline-job", on: { click: () => openJob(job.id) }, text: title })
          : h("span", { class: "timeline-static", text: title }),
        when ? h("time", timeProps) : null
      ),
      entry.text ? h("p", { class: "timeline-text", text: entry.text }) : null
    )
  );
}
