const ACTIONS = ["started", "update", "handoff", "blocked", "done", "comment"];

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function splitTitle(title) {
  const raw = asText(title).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\S[\s\S]*)$/);
  if (!match) return { date: "", title: raw || "Untitled" };
  return { date: match[1], title: match[2].trim() || raw };
}

function nowOf(ctx) {
  return ctx && ctx.now instanceof Date ? ctx.now : new Date();
}

function mount(root, ui, node) {
  if (ui && typeof ui.clear === "function") ui.clear(root);
  else root.replaceChildren();
  root.append(node);
}

function safeUrl(value) {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";
  let url;
  try {
    url = new URL(raw);
  } catch {
    return "";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  return url.href;
}

function linkParts(link) {
  if (typeof link === "string") return { label: link, url: link };
  if (!link || typeof link !== "object") return null;
  const url = typeof link.url === "string" ? link.url : "";
  const label = typeof link.label === "string" && link.label.trim() ? link.label : url;
  if (!label && !url) return null;
  return { label: label || url, url };
}

function linkNode(ui, link) {
  const parts = linkParts(link);
  if (!parts) return null;
  const href = safeUrl(parts.url);
  if (!href) return ui.h("span", { class: "detail-link is-dead" }, parts.label);
  return ui.h(
    "a",
    {
      class: "detail-link",
      href,
      target: "_blank",
      rel: "noopener noreferrer"
    },
    ui.h("span", { class: "detail-link-icon", "aria-hidden": "true" }, ui.icon("external", { size: 14 })),
    ui.h("span", {}, parts.label)
  );
}

function formatHours(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const rounded = Math.round(hours * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}h`;
}

function dateTime(store, iso) {
  if (typeof iso !== "string" || !iso) return "—";
  return store.fmtDateTime(iso) || "—";
}

function dateOnly(store, value) {
  if (typeof value !== "string" || !value) return "—";
  return store.fmtDate(value) || "—";
}

function requesterText(store, job) {
  const raw = typeof job.requester === "string" ? job.requester : "";
  if (!raw) return "—";
  const member = store.member(raw);
  return (member && member.name) || raw;
}

function actionLabel(store, action) {
  if (typeof action !== "string" || !action) return "";
  return (store.ACTION_LABEL && store.ACTION_LABEL[action]) || action;
}

function memberName(store, id) {
  const member = store.member(id);
  return (member && member.name) || id;
}

function assigneeIds(job) {
  const lead = typeof job.lead === "string" ? job.lead : "";
  const ids = [];
  asArray(job.assignees).forEach((id) => {
    if (typeof id === "string" && id && id !== lead && !ids.includes(id)) ids.push(id);
  });
  return ids;
}

function involvedIds(store, job, entries) {
  const ids = [];
  const push = (id) => {
    if (typeof id === "string" && id && !ids.includes(id)) ids.push(id);
  };
  push(job.lead);
  asArray(job.assignees).forEach(push);
  const extras = [];
  entries.forEach((entry) => {
    const id = entry && typeof entry.memberId === "string" ? entry.memberId : "";
    if (id && !ids.includes(id) && !extras.includes(id)) extras.push(id);
  });
  extras.sort((a, b) => memberName(store, a).localeCompare(memberName(store, b), undefined, { sensitivity: "base" }));
  return ids.concat(extras);
}

function latestEntry(entries) {
  let best = null;
  let bestAt = "";
  entries.forEach((entry) => {
    const at = entry && typeof entry.at === "string" ? entry.at : "";
    if (!best || at > bestAt) {
      best = entry;
      bestAt = at;
    }
  });
  return best;
}

function section(ui, title, ...nodes) {
  return ui.h("section", { class: "detail-section" }, ui.h("h3", { class: "detail-h" }, title), ...nodes);
}

function field(ui, label, value, late) {
  return ui.h(
    "div",
    { class: "detail-field" },
    ui.h("dt", {}, label),
    ui.h("dd", {}, late ? ui.h("span", { class: "detail-due is-late" }, value) : value)
  );
}

function personButton(ui, store, ctx, id, role) {
  if (!id) return null;
  return ui.h(
    "button",
    {
      type: "button",
      class: cx("detail-person", role === "Lead" ? "is-lead" : "is-assignee"),
      on: { click: () => ctx.openMember(id) }
    },
    ui.avatar(id, { size: role === "Lead" ? "lg" : "sm", ring: true, title: true }),
    ui.h(
      "span",
      { class: "detail-person-text" },
      role ? ui.h("span", { class: "detail-kicker" }, role) : null,
      ui.h("span", { class: "detail-person-name" }, memberName(store, id))
    )
  );
}

function durationText(store, job) {
  const start = job.startedAt || job.createdAt;
  if (!start) return "—";
  return formatHours(store.durationHours(start, job.completedAt));
}

function subtaskSection(ui, job) {
  const items = asArray(job.subtasks).filter((item) => item && typeof item === "object");
  if (!items.length) return null;
  const done = items.filter((item) => item.done === true).length;
  const total = items.length;
  const pct = Math.round((done / total) * 100);
  const fill = ui.h("span", { class: cx("detail-bar-fill", done === total && "is-full") });
  if (fill && fill.style) fill.style.width = `${pct}%`;
  return section(
    ui,
    "Subtasks",
    ui.h(
      "div",
      { class: "detail-progress" },
      ui.h(
        "div",
        {
          class: "detail-bar",
          role: "progressbar",
          "aria-valuemin": "0",
          "aria-valuemax": "100",
          "aria-valuenow": String(pct),
          "aria-valuetext": `${done} of ${total}`,
          "aria-label": "Subtask progress"
        },
        fill
      ),
      ui.h("span", { class: "detail-progress-label" }, `${done}/${total}`)
    ),
    ui.h(
      "ul",
      { class: "detail-tasks" },
      ...items.map((item) => {
        const complete = item.done === true;
        const title = asText(item.title).trim() || "Untitled";
        const memberId = typeof item.memberId === "string" ? item.memberId : "";
        return ui.h(
          "li",
          { class: cx("detail-task", complete && "is-done") },
          ui.h(
            "span",
            { class: cx("detail-tick", complete && "is-done"), "aria-hidden": "true" },
            ui.icon("check-circle", { size: 16 })
          ),
          memberId ? ui.avatar(memberId, { size: "xs", ring: false, title: true }) : null,
          ui.h("span", { class: "detail-task-title" }, title),
          ui.h("span", { class: "detail-sr" }, complete ? "Done" : "Open")
        );
      })
    )
  );
}

function linksSection(ui, links, title) {
  const nodes = asArray(links).map((link) => linkNode(ui, link)).filter(Boolean);
  if (!nodes.length) return null;
  return section(
    ui,
    title,
    ui.h(
      "ul",
      { class: "detail-links" },
      ...nodes.map((node) => ui.h("li", {}, node))
    )
  );
}

function parentSection(ui, store, ctx, job) {
  if (typeof job.parentJobId !== "string" || !job.parentJobId) return null;
  const parent = store.jobById(job.parentJobId);
  const title = parent ? splitTitle(parent.title).title : job.parentJobId;
  return section(
    ui,
    "Parent",
    ui.h(
      "button",
      {
        type: "button",
        class: "detail-parent",
        "aria-label": `Open parent job ${title}`,
        on: { click: () => ctx.openJob(job.parentJobId) }
      },
      ui.h("span", { class: "detail-kicker" }, "Open parent job"),
      ui.h("span", { class: "detail-parent-title" }, title)
    )
  );
}

function entryNode(ui, store, ctx, entry, now) {
  const memberId = typeof entry.memberId === "string" ? entry.memberId : "";
  const name = memberId ? memberName(store, memberId) : "Unknown";
  const action = typeof entry.action === "string" ? entry.action : "";
  const label = actionLabel(store, action);
  const when = typeof entry.at === "string" ? entry.at : "";
  const text = typeof entry.text === "string" ? entry.text : "";
  const links = asArray(entry.links).map((link) => linkNode(ui, link)).filter(Boolean);
  const actionProps = { class: "detail-action" };
  if (ACTIONS.includes(action)) actionProps["data-action"] = action;
  return ui.h(
    "li",
    { class: "detail-entry" },
    ui.h("span", { class: "detail-rail", "aria-hidden": "true" }),
    ui.h(
      "div",
      { class: "detail-av" },
      memberId
        ? ui.avatar(memberId, { size: "sm", ring: true, title: true })
        : ui.h("span", { class: "detail-av-fallback", "aria-hidden": "true" }, "?")
    ),
    ui.h(
      "div",
      { class: "detail-entry-body" },
      ui.h(
        "div",
        { class: "detail-entry-top" },
        memberId
          ? ui.h(
              "button",
              {
                type: "button",
                class: "detail-namebtn",
                on: { click: () => ctx.openMember(memberId) }
              },
              name
            )
          : ui.h("span", { class: "detail-person-name" }, name),
        label
          ? ui.h(
              "span",
              actionProps,
              ui.h("span", { class: "detail-action-icon", "aria-hidden": "true" }, ui.actionIcon(action)),
              ui.h("span", {}, label)
            )
          : null
      ),
      text ? ui.h("p", { class: "detail-prose" }, text) : null,
      links.length ? ui.h("div", { class: "detail-entry-links" }, ...links) : null,
      when
        ? ui.h(
            "p",
            { class: "detail-time" },
            ui.h("time", { datetime: when }, store.fmtDateTime(when) || when),
            " · ",
            store.relTime(when, now)
          )
        : null
    )
  );
}

function timelineSection(ui, store, ctx, entries, now) {
  const body = entries.length
    ? ui.h(
        "ol",
        { class: "detail-log" },
        ...entries.map((entry) => entryNode(ui, store, ctx, entry, now))
      )
    : ui.h("p", { class: "detail-placeholder" }, "No activity yet.");
  return section(ui, "Activity", body);
}

function whoSection(ui, store, ctx, job, entries) {
  const ids = involvedIds(store, job, entries);
  if (!ids.length) {
    return section(ui, "Who did what", ui.h("p", { class: "detail-placeholder" }, "No one is assigned yet."));
  }
  return section(
    ui,
    "Who did what",
    ui.h(
      "div",
      { class: "detail-who" },
      ...ids.map((id) => {
        const mine = entries.filter((entry) => entry && entry.memberId === id);
        const last = latestEntry(mine);
        const action = last ? actionLabel(store, last.action) : "";
        const count = mine.length;
        const meta = action
          ? `${count} ${count === 1 ? "log" : "logs"} · Last: ${action}`
          : `${count} ${count === 1 ? "log" : "logs"}`;
        return ui.h(
          "button",
          {
            type: "button",
            class: "detail-who-row",
            on: { click: () => ctx.openMember(id) }
          },
          ui.avatar(id, { size: "sm", ring: true, title: true }),
          ui.h(
            "span",
            { class: "detail-who-main" },
            ui.h("span", { class: "detail-person-name" }, memberName(store, id)),
            ui.h("span", { class: "detail-who-meta" }, meta)
          )
        );
      })
    )
  );
}

function hero(ui, store, ctx, job) {
  const { date, title } = splitTitle(job.title);
  const dateText = date ? store.fmtDate(date) || date : "";
  const tags = asArray(job.tags).filter((tag) => typeof tag === "string" && tag.trim());
  const lead = typeof job.lead === "string" ? job.lead : "";
  const assignees = assigneeIds(job);
  return ui.h(
    "header",
    { class: "detail-hero" },
    dateText ? ui.h("p", { class: "detail-date" }, dateText) : null,
    ui.h("h2", { class: "detail-title" }, title),
    ui.h(
      "div",
      { class: "detail-chips" },
      job.status ? ui.statusChip(job.status) : null,
      job.priority ? ui.priorityChip(job.priority) : null,
      job.division ? ui.divisionBadge(job.division) : null
    ),
    tags.length ? ui.h("div", { class: "detail-tags" }, ...tags.map((tag) => ui.tagChip(tag))) : null,
    lead || assignees.length
      ? ui.h(
          "div",
          { class: "detail-people" },
          personButton(ui, store, ctx, lead, "Lead"),
          assignees.length
            ? ui.h(
                "div",
                { class: "detail-assignees" },
                ui.h("p", { class: "detail-kicker" }, "Assignees"),
                ui.h(
                  "div",
                  { class: "detail-assignee-row" },
                  ...assignees.map((id) => personButton(ui, store, ctx, id, ""))
                )
              )
            : null
        )
      : null
  );
}

function metaGrid(ui, store, job, now) {
  const overdue = !!(job.due && store.isOverdue(job, now));
  return ui.h(
    "dl",
    { class: "detail-meta" },
    field(ui, "Requester", requesterText(store, job)),
    field(ui, "Created", dateTime(store, job.createdAt)),
    field(ui, "Started", dateTime(store, job.startedAt)),
    field(ui, "Completed", dateTime(store, job.completedAt)),
    field(ui, "Due", dateOnly(store, job.due), overdue),
    job.completedAt ? field(ui, "Duration", durationText(store, job)) : null
  );
}

export function render(root, ctx, jobId) {
  const { store, ui } = ctx;
  const job = jobId ? store.jobById(jobId) : null;
  if (!job) {
    mount(root, ui, ui.h("div", { class: "detail-missing" }, ui.empty("Job not found")));
    return;
  }
  const now = nowOf(ctx);
  const entries = asArray(store.jobTimeline(job)).filter((entry) => entry && typeof entry === "object");
  const asked = typeof job.description === "string" ? job.description : "";
  const result = typeof job.result === "string" ? job.result : "";
  mount(
    root,
    ui,
    ui.h(
      "article",
      { class: "detail" },
      hero(ui, store, ctx, job),
      metaGrid(ui, store, job, now),
      section(
        ui,
        "What Dong asked",
        asked.trim()
          ? ui.h("p", { class: "detail-prose detail-ask" }, asked)
          : ui.h("p", { class: "detail-prose detail-ask is-empty" }, "Nothing noted yet.")
      ),
      result.trim() ? section(ui, "Result", ui.h("div", { class: "detail-result" }, result)) : null,
      subtaskSection(ui, job),
      linksSection(ui, job.links, "Links"),
      parentSection(ui, store, ctx, job),
      timelineSection(ui, store, ctx, entries, now),
      whoSection(ui, store, ctx, job, entries)
    )
  );
}
