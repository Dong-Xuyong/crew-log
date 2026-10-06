const DIVISIONS = ["command", "ops", "career", "health", "brand"];
const KNOWN_STATUS = new Set(["todo", "in_progress", "blocked", "review", "complete", "cancelled"]);
const FALLBACK_STATUSES = ["todo", "in_progress", "blocked", "review", "complete", "cancelled"];
const SORT_KEYS = ["title", "assignees", "status", "priority", "due", "division", "updated"];
const COLUMNS = [
  { key: "title", label: "Title" },
  { key: "assignees", label: "Assignees" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "due", label: "Due" },
  { key: "division", label: "Division" },
  { key: "updated", label: "Updated" }
];
const GROUPS = [
  { id: "", label: "None" },
  { id: "status", label: "Status" },
  { id: "division", label: "Division" },
  { id: "member", label: "Member" }
];
const NARROW_QUERY = "(max-width: 639px)";

const collapsedGroups = new Set();
let stopWatch = null;

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

function nowOf(ctx) {
  return ctx && ctx.now instanceof Date ? ctx.now : new Date();
}

function isChanged(store, id) {
  const changed = store && store.state && store.state.changedIds;
  return !!(id && changed && typeof changed.has === "function" && changed.has(id));
}

function param(params, key) {
  if (!params || typeof params.get !== "function") return "";
  return params.get(key) || "";
}

function groupMode(params) {
  const value = param(params, "group");
  return value === "status" || value === "division" || value === "member" ? value : "";
}

function sortState(params) {
  const sort = param(params, "sort");
  return {
    sort: SORT_KEYS.includes(sort) ? sort : "",
    dir: param(params, "dir") === "desc" ? "desc" : "asc"
  };
}

function mount(root, ui, node) {
  if (ui && typeof ui.clear === "function") ui.clear(root);
  else root.replaceChildren();
  root.append(node);
}

function unwatch() {
  if (stopWatch) {
    stopWatch();
    stopWatch = null;
  }
}

function isNarrow() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(NARROW_QUERY).matches
  );
}

function armWatch(root, ctx) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  const mq = window.matchMedia(NARROW_QUERY);
  const onChange = () => {
    if (!root.isConnected || root.getAttribute("data-work-view") !== "list") {
      mq.removeEventListener("change", onChange);
      return;
    }
    render(root, ctx);
  };
  mq.addEventListener("change", onChange);
  stopWatch = () => mq.removeEventListener("change", onChange);
}

function sortValue(job, key, store) {
  if (key === "title") return splitTitle(job.title).title || null;
  if (key === "assignees") {
    const names = peopleIds(job).map((id) => {
      const member = store.member(id);
      return (member && member.name) || id;
    });
    return names.length ? names.join(", ") : null;
  }
  if (key === "status") {
    const list = Array.isArray(store.STATUSES) && store.STATUSES.length ? store.STATUSES : FALLBACK_STATUSES;
    const index = list.indexOf(job.status);
    return index === -1 ? null : index;
  }
  if (key === "priority") {
    const list = Array.isArray(store.PRIORITIES) && store.PRIORITIES.length ? store.PRIORITIES : ["urgent", "high", "normal", "low"];
    const index = list.indexOf(job.priority);
    return index === -1 ? null : index;
  }
  if (key === "due") return typeof job.due === "string" && job.due ? job.due : null;
  if (key === "division") {
    if (typeof job.division !== "string" || !job.division) return null;
    const division = store.division(job.division);
    return (division && division.name) || job.division;
  }
  if (key === "updated") {
    const stamp = job.updatedAt || job.createdAt;
    return typeof stamp === "string" && stamp ? stamp : null;
  }
  return null;
}

function compareJob(a, b, key, sign, store) {
  const left = sortValue(a, key, store);
  const right = sortValue(b, key, store);
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === "number" && typeof right === "number") {
    if (left === right) return 0;
    return left < right ? -sign : sign;
  }
  return String(left).localeCompare(String(right), undefined, { sensitivity: "base", numeric: true }) * sign;
}

function sortJobs(jobs, sort, dir, store) {
  if (!sort) return jobs.slice();
  const sign = dir === "desc" ? -1 : 1;
  return jobs.slice().sort((a, b) => compareJob(a, b, sort, sign, store));
}

function applySort(ctx, key) {
  const { sort, dir } = sortState(ctx.params);
  if (sort !== key) {
    const first = key === "due" || key === "updated" ? "desc" : "asc";
    ctx.go({ sort: key, dir: first });
    return;
  }
  ctx.go({ dir: dir === "asc" ? "desc" : "asc" });
}

function divisionName(store, id) {
  const division = store.division(id);
  return (division && division.name) || id;
}

function groupByStatus(jobs, store) {
  const statuses = Array.isArray(store.STATUSES) && store.STATUSES.length ? store.STATUSES : FALLBACK_STATUSES;
  const map = new Map(statuses.map((status) => [status, []]));
  const other = [];
  for (const job of jobs) {
    if (map.has(job.status)) map.get(job.status).push(job);
    else other.push(job);
  }
  const groups = statuses
    .filter((status) => map.get(status).length)
    .map((status) => ({
      id: status,
      label: (store.STATUS_LABEL && store.STATUS_LABEL[status]) || status,
      kind: "status",
      status: KNOWN_STATUS.has(status) ? status : "",
      jobs: map.get(status)
    }));
  if (other.length) groups.push({ id: "other", label: "Other", kind: "status", status: "", jobs: other });
  return groups;
}

function groupByDivision(jobs, store) {
  const divisions = typeof store.divisions === "function" ? store.divisions() || [] : [];
  const map = new Map();
  const order = [];
  const ensure = (id) => {
    if (!map.has(id)) {
      map.set(id, []);
      order.push(id);
    }
    return map.get(id);
  };
  divisions.forEach((division) => {
    if (division && typeof division.id === "string" && division.id) ensure(division.id);
  });
  const unknown = [];
  for (const job of jobs) {
    const id = typeof job.division === "string" ? job.division : "";
    if (!id) {
      unknown.push(job);
      continue;
    }
    ensure(id).push(job);
  }
  const groups = order
    .filter((id) => map.get(id).length)
    .map((id) => ({
      id,
      label: divisionName(store, id),
      kind: "division",
      division: divisionId(id),
      jobs: map.get(id)
    }));
  if (unknown.length) {
    groups.push({ id: "none", label: "No division", kind: "division", division: "", jobs: unknown });
  }
  return groups;
}

function groupByMember(jobs, store) {
  const map = new Map();
  const order = [];
  const ensure = (id) => {
    if (!map.has(id)) {
      map.set(id, []);
      order.push(id);
    }
    return map.get(id);
  };
  for (const job of jobs) {
    const ids = peopleIds(job);
    if (!ids.length) ensure("").push(job);
    else ids.forEach((id) => ensure(id).push(job));
  }
  const groups = order.map((id) => {
    const member = id ? store.member(id) : null;
    return {
      id: id || "unassigned",
      memberId: id,
      label: id ? (member && member.name) || id : "Unassigned",
      kind: "member",
      jobs: map.get(id)
    };
  });
  groups.sort((a, b) => {
    if (!a.memberId) return 1;
    if (!b.memberId) return -1;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
  return groups;
}

function groupJobs(jobs, mode, store) {
  if (mode === "status") return groupByStatus(jobs, store);
  if (mode === "division") return groupByDivision(jobs, store);
  if (mode === "member") return groupByMember(jobs, store);
  return [];
}

function toggleGroup(root, ctx, key) {
  if (collapsedGroups.has(key)) collapsedGroups.delete(key);
  else collapsedGroups.add(key);
  render(root, ctx);
}

function groupButton(root, ui, ctx, mode, group) {
  const key = `${mode}:${group.id}`;
  const open = !collapsedGroups.has(key);
  const props = {
    type: "button",
    class: "list-group",
    "aria-expanded": open ? "true" : "false",
    on: {
      click: () => toggleGroup(root, ctx, key)
    }
  };
  if (group.status) props["data-status"] = group.status;
  if (group.division) props["data-division"] = group.division;
  const mark =
    group.kind === "member"
      ? group.memberId
        ? ui.avatar(group.memberId, { size: "sm", ring: true, title: true })
        : null
      : ui.h("span", {
          class: "list-dot",
          "aria-hidden": "true",
          ...(group.status ? { "data-status": group.status } : {}),
          ...(group.division ? { "data-division": group.division } : {})
        });
  return ui.h(
    "button",
    props,
    ui.h(
      "span",
      { class: cx("list-chevron", open && "is-open"), "aria-hidden": "true" },
      ui.icon("chevron-right", { size: 16 })
    ),
    mark,
    ui.h("span", { class: "list-glabel" }, group.label),
    ui.h("span", { class: "list-gcount" }, String(group.jobs.length))
  );
}

function toolbar(ui, ctx, mode, count) {
  return ui.h(
    "div",
    { class: "list-toolbar" },
    ui.h(
      "div",
      { class: "list-segments", role: "group", "aria-label": "Group by" },
      ...GROUPS.map((group) =>
        ui.h(
          "button",
          {
            type: "button",
            class: "list-seg",
            "aria-pressed": mode === group.id ? "true" : "false",
            on: {
              click: () => {
                if (mode === group.id) return;
                ctx.go({ group: group.id ? group.id : null });
              }
            }
          },
          group.label
        )
      )
    ),
    ui.h("p", { class: "list-total" }, `${count} ${count === 1 ? "job" : "jobs"}`)
  );
}

function sortbar(ui, ctx, sort, dir) {
  return ui.h(
    "div",
    { class: "list-sortbar", role: "group", "aria-label": "Sort by" },
    ...COLUMNS.map((column) => {
      const active = sort === column.key;
      return ui.h(
        "button",
        {
          type: "button",
          class: cx("list-sortchip", active && "is-on"),
          "aria-pressed": active ? "true" : "false",
          on: { click: () => applySort(ctx, column.key) }
        },
        column.label,
        active ? ui.h("span", { "aria-hidden": "true" }, dir === "desc" ? " ↓" : " ↑") : null
      );
    })
  );
}

function headerCell(ui, ctx, column, sort, dir) {
  const active = sort === column.key;
  const aria = active ? (dir === "desc" ? "descending" : "ascending") : "none";
  const name = active
    ? `${column.label}, sorted ${dir === "desc" ? "descending" : "ascending"}`
    : `Sort by ${column.label}`;
  return ui.h(
    "th",
    { scope: "col", "aria-sort": aria },
    ui.h(
      "button",
      {
        type: "button",
        class: cx("list-sortbtn", active && "is-active"),
        "aria-label": name,
        on: { click: () => applySort(ctx, column.key) }
      },
      column.label,
      active ? ui.h("span", { class: "list-dir", "aria-hidden": "true" }, dir === "desc" ? "↓" : "↑") : null
    )
  );
}

function dataRow(ui, store, ctx, job, now) {
  const { date, title } = splitTitle(job.title);
  const dateText = date ? store.fmtDate(date) || date : "";
  const ids = peopleIds(job);
  const div = typeof job.division === "string" ? job.division : "";
  const knownDiv = divisionId(div);
  const overdue = !!(job.due && store.isOverdue(job, now));
  const dueText = job.due ? store.fmtDate(job.due) || String(job.due) : "—";
  const stamp = job.updatedAt || job.createdAt || "";
  const updated = stamp ? store.relTime(stamp, now) : "—";
  const full = stamp ? store.fmtDateTime(stamp) : "";
  const props = { class: cx("list-row", isChanged(store, job.id) && "flash") };
  if (knownDiv) props["data-division"] = knownDiv;
  if (job.id) {
    props.tabindex = "0";
    props.on = {
      click: () => ctx.openJob(job.id),
      keydown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          ctx.openJob(job.id);
        }
      }
    };
  }
  const updatedProps = { class: "list-updated" };
  if (full) updatedProps.title = full;
  return ui.h(
    "tr",
    props,
    ui.h(
      "td",
      { class: "list-titlecell" },
      ui.h(
        "span",
        { class: "list-titleblock" },
        dateText ? ui.h("span", { class: "list-date" }, dateText) : null,
        ui.h("span", { class: "list-title" }, title)
      )
    ),
    ui.h("td", {}, ids.length ? ui.avatarStack(ids, { max: 3, size: "sm" }) : "—"),
    ui.h("td", {}, job.status ? ui.statusChip(job.status) : "—"),
    ui.h("td", {}, job.priority ? ui.priorityChip(job.priority) : "—"),
    ui.h(
      "td",
      {},
      ui.h(
        "span",
        { class: "list-duewrap" },
        overdue ? ui.h("span", { class: "list-sr" }, "Overdue") : null,
        ui.h("span", { class: cx("list-due", overdue && "is-late") }, dueText)
      )
    ),
    ui.h(
      "td",
      {},
      div
        ? ui.h(
            "span",
            { class: "list-div" },
            knownDiv
              ? ui.h("span", { class: "list-dot", "data-division": knownDiv, "aria-hidden": "true" })
              : null,
            ui.h("span", {}, divisionName(store, div))
          )
        : "—"
    ),
    ui.h("td", {}, ui.h("span", updatedProps, updated))
  );
}

function tableView(root, ui, store, ctx, jobs, groups, mode, sort, dir, now) {
  const bodies = mode
    ? groups.map((group) => {
        const key = `${mode}:${group.id}`;
        const open = !collapsedGroups.has(key);
        const rows = open ? group.jobs.map((job) => dataRow(ui, store, ctx, job, now)) : [];
        return ui.h(
          "tbody",
          {},
          ui.h(
            "tr",
            { class: "list-group-row" },
            ui.h("th", { colspan: "7", scope: "rowgroup" }, groupButton(root, ui, ctx, mode, group))
          ),
          ...rows
        );
      })
    : [ui.h("tbody", {}, ...jobs.map((job) => dataRow(ui, store, ctx, job, now)))];
  return ui.h(
    "div",
    { class: "list-wrap" },
    ui.h(
      "table",
      { class: "list-table" },
      ui.h("caption", { class: "list-caption" }, "Jobs"),
      ui.h(
        "thead",
        {},
        ui.h(
          "tr",
          {},
          ...COLUMNS.map((column) => headerCell(ui, ctx, column, sort, dir))
        )
      ),
      ...bodies
    )
  );
}

function mobileCard(ui, store, ctx, job, now) {
  const { date, title } = splitTitle(job.title);
  const dateText = date ? store.fmtDate(date) || date : "";
  const ids = peopleIds(job);
  const div = typeof job.division === "string" ? job.division : "";
  const knownDiv = divisionId(div);
  const overdue = !!(job.due && store.isOverdue(job, now));
  const dueText = job.due ? store.fmtDate(job.due) || String(job.due) : "";
  const stamp = job.updatedAt || job.createdAt || "";
  const rel = stamp ? store.relTime(stamp, now) : "";
  const props = {
    type: "button",
    class: cx("list-mcard", isChanged(store, job.id) && "flash"),
    on: {
      click: () => {
        if (job.id) ctx.openJob(job.id);
      }
    }
  };
  if (knownDiv) props["data-division"] = knownDiv;
  return ui.h(
    "button",
    props,
    dateText || job.status
      ? ui.h(
          "span",
          { class: "list-mtop" },
          dateText ? ui.h("span", { class: "list-date" }, dateText) : null,
          job.status ? ui.statusChip(job.status) : null
        )
      : null,
    ui.h("span", { class: "list-title" }, title),
    ui.h(
      "span",
      { class: "list-mmid" },
      ids.length ? ui.avatarStack(ids, { max: 4, size: "sm" }) : null,
      job.priority ? ui.priorityChip(job.priority) : null
    ),
    ui.h(
      "span",
      { class: "list-mmeta" },
      dueText
        ? ui.h(
            "span",
            { class: cx("list-due", overdue && "is-late") },
            overdue ? ui.h("span", { class: "list-sr" }, "Overdue") : null,
            dueText
          )
        : null,
      div ? ui.h("span", { class: "list-div" }, divisionName(store, div)) : null,
      rel ? ui.h("span", { class: "list-updated" }, rel) : null
    )
  );
}

function mobileList(root, ui, store, ctx, jobs, groups, mode, now) {
  if (!mode) {
    return ui.h(
      "div",
      { class: "list-cards" },
      ...jobs.map((job) => mobileCard(ui, store, ctx, job, now))
    );
  }
  return ui.h(
    "div",
    { class: "list-cards" },
    ...groups.map((group) => {
      const key = `${mode}:${group.id}`;
      const open = !collapsedGroups.has(key);
      return ui.h(
        "section",
        { class: "list-block" },
        groupButton(root, ui, ctx, mode, group),
        open
          ? ui.h(
              "div",
              { class: "list-block-body" },
              ...group.jobs.map((job) => mobileCard(ui, store, ctx, job, now))
            )
          : null
      );
    })
  );
}

export function render(root, ctx) {
  unwatch();
  const { store, ui } = ctx;
  root.setAttribute("data-work-view", "list");
  const now = nowOf(ctx);
  const jobs = (Array.isArray(ctx.jobs) ? ctx.jobs : []).filter((job) => job && typeof job === "object");
  const mode = groupMode(ctx.params);
  const { sort, dir } = sortState(ctx.params);
  const ordered = sortJobs(jobs, sort, dir, store);
  const groups = mode ? groupJobs(ordered, mode, store) : [];
  const narrow = isNarrow();
  const content = jobs.length
    ? narrow
      ? mobileList(root, ui, store, ctx, ordered, groups, mode, now)
      : tableView(root, ui, store, ctx, ordered, groups, mode, sort, dir, now)
    : ui.h("div", { class: "list-empty" }, ui.empty("No jobs match these filters", "list"));
  const parts = [toolbar(ui, ctx, mode, jobs.length)];
  if (narrow) parts.push(sortbar(ui, ctx, sort, dir));
  parts.push(content);
  mount(root, ui, ui.h("div", { class: "list" }, ...parts));
  armWatch(root, ctx);
}
