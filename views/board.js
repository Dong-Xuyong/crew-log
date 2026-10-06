const DIVISIONS = ["command", "ops", "career", "health", "brand"];
const KNOWN_STATUS = new Set(["todo", "in_progress", "blocked", "review", "complete", "cancelled"]);
const FALLBACK_STATUSES = ["todo", "in_progress", "blocked", "review", "complete", "cancelled"];

let cancelledExpanded = false;

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asText(title) {
  if (typeof title === "string") return title;
  if (typeof title === "number" && Number.isFinite(title)) return String(title);
  return "";
}

function splitTitle(title) {
  const raw = asText(title).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\S[\s\S]*)$/);
  if (!match) return { date: "", title: raw || "Untitled" };
  return { date: match[1], title: match[2].trim() || raw };
}

function peopleIds(job) {
  const ids = [];
  const push = (id) => {
    if (typeof id === "string" && id && !ids.includes(id)) ids.push(id);
  };
  if (job) {
    push(job.lead);
    asArray(job.assignees).forEach(push);
  }
  return ids;
}

function divisionId(value) {
  return DIVISIONS.includes(value) ? value : "";
}

function leadDivision(job, store) {
  const lead = job && job.lead ? store.member(job.lead) : null;
  return divisionId((lead && lead.division) || (job && job.division) || "");
}

function nowOf(ctx) {
  return ctx && ctx.now instanceof Date ? ctx.now : new Date();
}

function isChanged(store, id) {
  const changed = store && store.state && store.state.changedIds;
  return !!(id && changed && typeof changed.has === "function" && changed.has(id));
}

function statusesOf(store) {
  const list = store && Array.isArray(store.STATUSES) ? store.STATUSES : null;
  return list && list.length ? list : FALLBACK_STATUSES;
}

function statusLabel(store, status) {
  const labels = (store && store.STATUS_LABEL) || {};
  return labels[status] || status;
}

function mount(root, ui, node) {
  if (ui && typeof ui.clear === "function") ui.clear(root);
  else root.replaceChildren();
  root.append(node);
}

function jobsByStatus(jobs, statuses) {
  const map = new Map(statuses.map((status) => [status, []]));
  const rest = [];
  for (const job of jobs) {
    if (!job || typeof job !== "object") continue;
    const status = typeof job.status === "string" ? job.status : "";
    if (map.has(status)) map.get(status).push(job);
    else rest.push(job);
  }
  if (rest.length) {
    const key = map.has("todo") ? "todo" : statuses[0];
    if (key && map.has(key)) map.get(key).push(...rest);
  }
  return map;
}

function sr(ui, text) {
  return ui.h("span", { class: "card-sr" }, text);
}

function stat(ui, iconName, visual, label) {
  return ui.h(
    "span",
    { class: "card-stat" },
    ui.h(
      "span",
      { class: "card-stat-label", "aria-hidden": "true" },
      ui.icon(iconName, { size: 14 }),
      visual
    ),
    sr(ui, label)
  );
}

function duePill(ui, store, job, now) {
  if (!job || typeof job.due !== "string" || !job.due) return null;
  const text = store.fmtDate(job.due) || job.due;
  const overdue = !!store.isOverdue(job, now);
  return ui.h(
    "span",
    { class: cx("card-due", overdue && "is-late") },
    ui.h(
      "span",
      { class: "card-due-label", "aria-hidden": "true" },
      ui.icon("clock", { size: 12 }),
      text
    ),
    sr(ui, overdue ? `Overdue, due ${text}` : `Due ${text}`)
  );
}

function tagNodes(ui, job) {
  const tags = asArray(job && job.tags).filter((tag) => typeof tag === "string" && tag.trim());
  const nodes = tags.slice(0, 3).map((tag) => ui.tagChip(tag));
  if (tags.length > 3) {
    nodes.push(
      ui.h("span", { class: "card-more", title: tags.slice(3).join(", ") }, `+${tags.length - 3}`)
    );
  }
  return nodes;
}

function card(ui, store, ctx, job, now) {
  const { date, title } = splitTitle(job.title);
  const dateText = date ? store.fmtDate(date) || date : "";
  const ids = peopleIds(job);
  const priority = typeof job.priority === "string" ? job.priority : "";
  const showPriority = priority && priority !== "normal";
  const logs = asArray(job.log).length;
  const subs = asArray(job.subtasks);
  const done = subs.filter((item) => item && item.done === true).length;
  const stamp = job.updatedAt || job.createdAt || "";
  const stampText = typeof stamp === "string" ? stamp : "";
  const fullTime = stampText ? store.fmtDateTime(stampText) : "";
  const rel = stampText ? store.relTime(stampText, now) : "";
  const div = leadDivision(job, store);
  const chips = [duePill(ui, store, job, now), ...tagNodes(ui, job)].filter(Boolean);
  const props = {
    type: "button",
    class: cx("card-job", isChanged(store, job.id) && "flash"),
    on: {
      click: () => {
        if (job.id) ctx.openJob(job.id);
      }
    }
  };
  if (div) props["data-division"] = div;
  if (job.id) props["data-job-id"] = String(job.id);

  const updatedProps = { class: "card-updated" };
  if (fullTime) updatedProps.title = fullTime;

  return ui.h(
    "button",
    props,
    dateText ? ui.h("span", { class: "card-date" }, dateText) : null,
    ui.h("span", { class: "card-title" }, title),
    ids.length || showPriority
      ? ui.h(
          "div",
          { class: "card-mid" },
          ids.length ? ui.avatarStack(ids, { max: 4, size: "sm" }) : ui.h("span", { class: "card-spacer" }),
          showPriority ? ui.priorityChip(priority) : null
        )
      : null,
    chips.length ? ui.h("div", { class: "card-chips" }, ...chips) : null,
    ui.h(
      "div",
      { class: "card-foot" },
      stat(ui, "message", String(logs), `${logs} log ${logs === 1 ? "entry" : "entries"}`),
      subs.length
        ? stat(ui, "check", `${done}/${subs.length}`, `Subtasks ${done} of ${subs.length}`)
        : null,
      rel ? ui.h("span", updatedProps, rel) : null
    )
  );
}

function column(root, ui, store, ctx, status, jobs, now) {
  const label = statusLabel(store, status);
  const count = jobs.length;
  const cancelled = status === "cancelled";
  const expanded = !cancelled || cancelledExpanded;
  const props = { class: cx("board-col", !expanded && "is-collapsed") };
  if (KNOWN_STATUS.has(status)) props["data-status"] = status;

  if (!expanded) {
    return ui.h(
      "section",
      props,
      ui.h(
        "button",
        {
          type: "button",
          class: "board-toggle is-stack",
          "aria-expanded": "false",
          "aria-label": `Expand cancelled column, ${count} ${count === 1 ? "job" : "jobs"}`,
          on: {
            click: () => {
              cancelledExpanded = true;
              render(root, ctx);
            }
          }
        },
        ui.h("span", { class: "board-dot", "aria-hidden": "true" }),
        ui.h("span", { class: "board-vlabel" }, label),
        ui.h("span", { class: "board-count" }, String(count)),
        ui.icon("chevron-right", { size: 16 })
      )
    );
  }

  const cards = jobs.map((job) => card(ui, store, ctx, job, now));
  return ui.h(
    "section",
    props,
    ui.h(
      "header",
      { class: "board-head" },
      ui.h("span", { class: "board-dot", "aria-hidden": "true" }),
      ui.h("h3", { class: "board-label" }, label),
      ui.h("span", { class: "board-count" }, String(count)),
      cancelled
        ? ui.h(
            "button",
            {
              type: "button",
              class: "board-toggle",
              "aria-expanded": "true",
              "aria-label": "Collapse cancelled column",
              on: {
                click: () => {
                  cancelledExpanded = false;
                  render(root, ctx);
                }
              }
            },
            ui.icon("chevron-left", { size: 16 })
          )
        : null
    ),
    ui.h(
      "div",
      { class: "board-body" },
      ...(cards.length ? cards : [ui.h("div", { class: "board-empty" }, "No jobs")])
    )
  );
}

export function render(root, ctx) {
  const { store, ui } = ctx;
  root.setAttribute("data-work-view", "board");
  const now = nowOf(ctx);
  const jobs = Array.isArray(ctx.jobs) ? ctx.jobs : [];
  const statuses = statusesOf(store);
  const grouped = jobsByStatus(jobs, statuses);
  mount(
    root,
    ui,
    ui.h(
      "div",
      { class: "board" },
      ...statuses.map((status) =>
        column(root, ui, store, ctx, status, grouped.get(status) || [], now)
      )
    )
  );
}
