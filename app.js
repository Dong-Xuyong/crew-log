import * as store from "./store.js";
import * as ui from "./ui.js";

const VIEWS = ["board", "list", "members", "automations", "profile", "org", "calendar", "dashboard"];
const VIEW_FILES = new Set(["board", "list", "members", "automations", "profile", "org", "calendar", "dashboard", "detail"]);
const FILTER_KEYS = ["q", "member", "status", "division", "priority", "tag", "from", "to"];
const COUNT_KEYS = ["member", "status", "division", "priority", "tag", "from", "to"];
const SYNC_KINDS = ["topbar-sync-demo", "topbar-sync-ok", "topbar-sync-off", "topbar-sync-busy"];
const VIEW_LABEL = {
  board: "Board",
  list: "List",
  members: "Members",
  automations: "Automations",
  profile: "Profile",
  org: "Org chart",
  calendar: "Calendar",
  dashboard: "Dashboard",
};

const viewModules = new Map();
let generation = 0;
let searchTimer = 0;
let updatesReady = false;
let lastChangeKey = "";
let lastShownError = "";
let filtersOpen = false;
let modalOpen = false;
let modalReturn = null;
let drawerReturn = null;
let paintedView = "";
let fromHistory = false;
let indicatorPlaced = false;
let lastTabId = "";

const $ = (id) => document.getElementById(id);

function bootTheme() {
  const run = () => {
    const toggle = document.querySelector("[data-dong-theme-toggle]");
    if (!window.DongUI || !toggle) return;
    if (toggle.getAttribute("data-dong-ready") === "1") return;
    window.DongUI.initTheme({ toggleEl: toggle });
  };
  window.setTimeout(run, 0);
}

function params() {
  return new URLSearchParams(location.search);
}

function currentView(query) {
  const view = query.get("view") || "board";
  return VIEWS.includes(view) ? view : "board";
}

function readFilters(query) {
  const filters = {};
  for (const key of FILTER_KEYS) {
    const value = query.get(key);
    if (value) filters[key] = value;
  }
  return filters;
}

function applyUpdates(updates, mode) {
  const next = new URLSearchParams(location.search);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  const qs = next.toString();
  const url = `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`;
  const current = `${location.pathname}${location.search}${location.hash}`;
  if (url === current) return false;
  const prev = history.state && typeof history.state === "object" ? history.state : {};
  const hasJob = next.has("job");
  const setsJob = Object.prototype.hasOwnProperty.call(updates, "job")
    && updates.job != null
    && String(updates.job) !== "";
  const pushed = mode === "push" ? setsJob : Boolean(prev.pushed && hasJob);
  const state = { crew: 1, pushed };
  if (mode === "push") history.pushState(state, "", url);
  else history.replaceState(state, "", url);
  return true;
}

function go(updates) {
  if (!updates || typeof updates !== "object") return;
  const keys = Object.keys(updates);
  const filterOnly = keys.length > 0 && keys.every((key) => FILTER_KEYS.includes(key));
  applyUpdates(updates, filterOnly ? "replace" : "push");
  render();
}

function closeJob() {
  const prev = history.state && typeof history.state === "object" ? history.state : null;
  if (prev && prev.pushed) {
    history.back();
    return;
  }
  applyUpdates({ job: null }, "replace");
  render();
}

function makeCtx(query) {
  const filters = readFilters(query);
  let jobs = [];
  try {
    const list = store.filterJobs(filters);
    jobs = Array.isArray(list) ? list : [];
  } catch {
    jobs = [];
  }
  let automations = [];
  try {
    const list = store.filterAutomations({
      q: filters.q || "",
      member: filters.member || "",
      division: filters.division || "",
      status: query.get("astatus") || "",
    });
    automations = Array.isArray(list) ? list : [];
  } catch {
    automations = [];
  }
  return {
    store,
    ui,
    params: new URLSearchParams(query.toString()),
    jobs,
    automations,
    now: new Date(),
    go,
    openJob(id) {
      go({ job: id });
    },
    openMember(id) {
      go({ view: "profile", m: id, job: null });
    },
  };
}

function publicError(message) {
  const text = String(message || "")
    .replace(/\b(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]+/g, "…")
    .replace(/Bearer\s+\S+/gi, "Bearer …");
  if (!text.trim() || text.length > 240) return "Could not refresh the crew log.";
  return text;
}

function toast(message, kind) {
  const region = $("toasts");
  if (!region || !message) return;
  const item = document.createElement("div");
  item.className = kind === "error" ? "toast toast-error" : "toast";
  item.setAttribute("role", "status");
  item.textContent = String(message);
  item.addEventListener("click", () => item.remove());
  region.append(item);
  while (region.children.length > 3) region.firstElementChild.remove();
  window.setTimeout(() => item.remove(), 3800);
}

function errorCard(message, titleText) {
  const card = document.createElement("div");
  card.className = "app-error";
  card.setAttribute("role", "alert");
  const title = document.createElement("h2");
  title.className = "app-error-title";
  title.textContent = titleText || "Something went wrong";
  const text = document.createElement("p");
  text.className = "app-error-text";
  text.textContent = message;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-ghost";
  button.textContent = "Try again";
  button.addEventListener("click", () => render());
  card.append(title, text, button);
  return card;
}

function skeletonBlock() {
  const wrap = document.createElement("div");
  wrap.className = "app-skeleton";
  wrap.setAttribute("aria-hidden", "true");
  const hero = document.createElement("div");
  hero.className = "skeleton app-skeleton-hero";
  const row = document.createElement("div");
  row.className = "app-skeleton-row";
  for (let i = 0; i < 3; i += 1) {
    const card = document.createElement("div");
    card.className = "skeleton app-skeleton-card";
    row.append(card);
  }
  wrap.append(hero, row);
  const note = document.createElement("p");
  note.className = "sr-only";
  note.textContent = "Loading crew log";
  const fragment = document.createDocumentFragment();
  fragment.append(wrap, note);
  return fragment;
}

function showSkeleton(main) {
  if (!main.querySelector(".app-skeleton")) main.replaceChildren(skeletonBlock());
  main.setAttribute("aria-busy", "true");
}

function changeKey(state) {
  const ids = state && state.changedIds;
  if (!ids) return "";
  let list = [];
  try {
    list = Array.from(ids);
  } catch {
    return "";
  }
  if (!list.length) return "";
  return list.map(String).sort().join("|");
}

function syncText(state) {
  if (state.demo) return "Demo";
  if (state.error) return "Offline (cached)";
  if (state.lastSync) {
    try {
      const iso = state.lastSync instanceof Date ? state.lastSync.toISOString() : String(state.lastSync);
      const formatted = store.fmtTime(iso);
      return formatted ? `Synced ${formatted}` : "Synced";
    } catch {
      return "Synced";
    }
  }
  return "Syncing…";
}

function syncKind(state) {
  if (state.demo) return "topbar-sync-demo";
  if (state.error) return "topbar-sync-off";
  if (state.lastSync) return "topbar-sync-ok";
  return "topbar-sync-busy";
}

function syncTopbarHeight() {
  const bar = document.querySelector(".topbar");
  if (!bar) return;
  document.documentElement.style.setProperty("--app-topbar-h", `${bar.offsetHeight}px`);
}

function placeIndicator() {
  const indicator = $("tabs-indicator");
  const current = document.querySelector('.tabs-btn[aria-current="page"]');
  if (!indicator) return;
  if (!current) {
    indicator.style.opacity = "0";
    return;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const instant = reduce || !indicatorPlaced;
  if (instant) indicator.style.transition = "none";
  indicator.style.width = `${current.offsetWidth}px`;
  indicator.style.transform = `translateX(${current.offsetLeft}px)`;
  indicator.style.opacity = "1";
  if (instant) {
    indicator.getBoundingClientRect();
    indicator.style.transition = "";
  }
  indicatorPlaced = true;
}

function scrollTabIntoView(btn) {
  const scroller = $("tabs-scroll");
  if (!scroller || !btn) return;
  const sRect = scroller.getBoundingClientRect();
  const bRect = btn.getBoundingClientRect();
  if (bRect.width === 0) return;
  if (bRect.left < sRect.left + 8) scroller.scrollLeft -= sRect.left + 8 - bRect.left;
  else if (bRect.right > sRect.right - 8) scroller.scrollLeft += bRect.right - (sRect.right - 8);
}

function syncTabs(view) {
  const activeId = view === "profile" ? "members" : view;
  let active = null;
  document.querySelectorAll(".tabs-btn").forEach((btn) => {
    if (btn.dataset.view === activeId) {
      btn.setAttribute("aria-current", "page");
      active = btn;
    } else {
      btn.removeAttribute("aria-current");
    }
  });
  if (active && lastTabId !== activeId) scrollTabIntoView(active);
  lastTabId = activeId;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function enumOptions(values, labels) {
  return asArray(values).map((value) => ({
    value: String(value),
    label: (labels && labels[value]) || String(value),
  }));
}

function memberOptions() {
  let list = [];
  try { list = asArray(store.members()); } catch { list = []; }
  return list
    .map((member) => ({
      value: member && member.id != null ? String(member.id) : "",
      label: member && member.name ? String(member.name) : (member && member.id != null ? String(member.id) : ""),
    }))
    .filter((member) => member.value)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function divisionOptions() {
  let list = [];
  try { list = asArray(store.divisions()); } catch { list = []; }
  return list
    .map((division) => ({
      value: division && division.id != null ? String(division.id) : "",
      label: division && division.name ? String(division.name) : (division && division.id != null ? String(division.id) : ""),
    }))
    .filter((division) => division.value);
}

function tagOptions() {
  let list = [];
  try { list = asArray(store.allTags()); } catch { list = []; }
  return list.map((tag) => ({ value: String(tag), label: String(tag) }));
}

function setOptions(select, options, current, anyLabel) {
  const list = options.slice();
  if (current && !list.some((opt) => opt.value === current)) {
    list.unshift({ value: current, label: current });
  }
  const sig = `${anyLabel}\n${list.map((opt) => `${opt.value}\t${opt.label}`).join("\n")}`;
  if (select.dataset.sig !== sig) {
    select.dataset.sig = sig;
    const frag = document.createDocumentFragment();
    const any = document.createElement("option");
    any.value = "";
    any.textContent = anyLabel;
    frag.append(any);
    for (const opt of list) {
      const node = document.createElement("option");
      node.value = opt.value;
      node.textContent = opt.label;
      frag.append(node);
    }
    const focused = document.activeElement === select;
    select.replaceChildren(frag);
    if (focused) select.focus();
  }
  if (select.value !== current) select.value = current;
}

function syncDate(input, value) {
  if (!fromHistory && document.activeElement === input) return;
  if (input.value !== value) input.value = value;
}

function activeFilterCount(query) {
  return COUNT_KEYS.reduce((count, key) => count + (query.get(key) ? 1 : 0), 0);
}

function filtersDesktop() {
  return window.matchMedia("(min-width: 721px)").matches;
}

function syncFiltersAria() {
  const open = filtersDesktop() || filtersOpen;
  $("filters-toggle").setAttribute("aria-expanded", open ? "true" : "false");
  $("filters-panel").classList.toggle("is-open", filtersOpen);
}

function syncFilters(query) {
  const search = $("search-input");
  if (fromHistory || document.activeElement !== search) {
    const q = query.get("q") || "";
    if (search.value !== q) search.value = q;
  }
  setOptions($("filter-member"), memberOptions(), query.get("member") || "", "Any member");
  setOptions($("filter-status"), enumOptions(store.STATUSES, store.STATUS_LABEL), query.get("status") || "", "Any status");
  setOptions($("filter-division"), divisionOptions(), query.get("division") || "", "Any division");
  setOptions($("filter-priority"), enumOptions(store.PRIORITIES, store.PRIORITY_LABEL), query.get("priority") || "", "Any priority");
  setOptions($("filter-tag"), tagOptions(), query.get("tag") || "", "Any tag");
  syncDate($("filter-from"), query.get("from") || "");
  syncDate($("filter-to"), query.get("to") || "");
  const count = activeFilterCount(query);
  $("filters-count-num").textContent = String(count);
  $("filters-count").hidden = count === 0;
  const dirty = count > 0 || Boolean((query.get("q") || "").trim()) || Boolean(search.value.trim());
  $("filters-clear").disabled = !dirty;
  syncFiltersAria();
}

function syncChrome(query, view, state) {
  const text = syncText(state);
  const label = $("sync-label");
  $("sync-text").textContent = text;
  label.title = text;
  label.classList.remove(...SYNC_KINDS);
  label.classList.add(syncKind(state));
  const refresh = $("refresh-btn");
  refresh.classList.toggle("is-loading", Boolean(state.loading));
  refresh.setAttribute("aria-busy", state.loading ? "true" : "false");
  $("demo-banner").hidden = !state.demo;
  syncTabs(view);
  syncFilters(query);
  placeIndicator();
  syncTopbarHeight();
  syncInert();
}

function syncInert() {
  const drawerOpen = !$("drawer-root").hidden;
  if (modalOpen) {
    $("app").inert = true;
    $("drawer-root").inert = drawerOpen;
  } else {
    $("app").inert = false;
    $("drawer-root").inert = false;
    $("app-body").inert = drawerOpen;
  }
}

function hideDrawer() {
  const root = $("drawer-root");
  const wasOpen = !root.hidden;
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");
  root.removeAttribute("data-job");
  const back = drawerReturn;
  drawerReturn = null;
  syncInert();
  if (wasOpen && !modalOpen && back && typeof back.focus === "function" && document.contains(back)) {
    back.focus();
  }
}

function loadView(name) {
  if (!VIEW_FILES.has(name)) return Promise.reject(new Error("unknown view"));
  const cached = viewModules.get(name);
  if (cached) return cached;
  const pending = import(`./views/${name}.js`).then(
    (mod) => {
      if (!mod || typeof mod.render !== "function") {
        viewModules.delete(name);
        throw new Error("missing render");
      }
      return mod;
    },
    (err) => {
      viewModules.delete(name);
      throw err;
    }
  );
  viewModules.set(name, pending);
  return pending;
}

function emptyNode(node) {
  try {
    if (typeof ui.clear === "function") {
      ui.clear(node);
      return;
    }
  } catch {
    /* fall through */
  }
  node.replaceChildren();
}

async function syncDrawer(jobId, ctx, gen) {
  if (!jobId || !ctx) {
    hideDrawer();
    return;
  }
  const root = $("drawer-root");
  const body = $("drawer-body");
  const opening = root.hidden;
  const switched = root.dataset.job !== jobId;
  if (opening) drawerReturn = document.activeElement;
  root.hidden = false;
  root.setAttribute("aria-hidden", "false");
  root.dataset.job = jobId;
  let heading = "Job";
  try {
    const job = store.jobById(jobId);
    if (job && job.title) heading = String(job.title);
  } catch {
    heading = "Job";
  }
  $("drawer-title").textContent = heading;
  const scroll = opening || switched ? 0 : body.scrollTop;
  if ((opening || switched) && !modalOpen) $("drawer-close").focus();
  syncInert();
  try {
    const mod = await loadView("detail");
    if (gen !== generation) return;
    try {
      emptyNode(body);
      const result = mod.render(body, ctx, jobId);
      if (result && typeof result.then === "function") await result;
    } catch {
      body.replaceChildren(errorCard("This job could not be shown."));
    }
  } catch {
    if (gen !== generation) return;
    body.replaceChildren(errorCard("This job could not be shown."));
  }
  if (gen !== generation) return;
  if (!opening && !switched) body.scrollTop = scroll;
}

async function paint(gen) {
  const query = params();
  const view = currentView(query);
  const state = store.state || {};
  syncChrome(query, view, state);
  const main = $("main");

  if (state.loading && !state.data) {
    showSkeleton(main);
    hideDrawer();
    return;
  }

  if (!state.data) {
    main.replaceChildren(errorCard(
      "The crew log has not loaded. Refresh, or connect GitHub in Settings.",
      "Nothing to show yet"
    ));
    main.setAttribute("aria-busy", "false");
    hideDrawer();
    return;
  }

  const ctx = makeCtx(query);
  const section = document.createElement("section");
  section.className = "app-view";
  section.setAttribute("aria-label", VIEW_LABEL[view] || "Crew log");
  try {
    const mod = await loadView(view);
    if (gen !== generation) return;
    try {
      const result = mod.render(section, ctx);
      if (result && typeof result.then === "function") await result;
    } catch {
      section.replaceChildren(errorCard("This view could not be shown. The rest of Crew Log is still available."));
    }
  } catch {
    if (gen !== generation) return;
    section.replaceChildren(errorCard("This view could not be shown. The rest of Crew Log is still available."));
  }
  if (gen !== generation) return;
  main.replaceChildren(section);
  main.setAttribute("aria-busy", "false");
  if (paintedView && paintedView !== view) window.scrollTo(0, 0);
  paintedView = view;
  await syncDrawer(query.get("job"), ctx, gen);
}

function render() {
  const gen = ++generation;
  paint(gen).catch(() => {
    if (gen !== generation) return;
    const main = $("main");
    main.replaceChildren(errorCard("This view could not be shown. The rest of Crew Log is still available."));
    main.setAttribute("aria-busy", "false");
  });
}

function noteState(state) {
  const err = state && state.error ? publicError(state.error) : "";
  if (err) {
    if (err !== lastShownError) {
      lastShownError = err;
      toast(err, "error");
    }
  } else {
    lastShownError = "";
  }
  const key = changeKey(state);
  if (updatesReady && key && key !== lastChangeKey && state && !state.demo) toast("Updated");
  lastChangeKey = key;
  render();
}

function requestRefresh() {
  if (store.state && store.state.loading) return;
  Promise.resolve(store.refresh()).catch(() => {});
}

function onFilterChange() {
  applyUpdates({
    member: $("filter-member").value || null,
    status: $("filter-status").value || null,
    division: $("filter-division").value || null,
    priority: $("filter-priority").value || null,
    tag: $("filter-tag").value || null,
    from: $("filter-from").value || null,
    to: $("filter-to").value || null,
  }, "replace");
  render();
}

function exportJSON() {
  const data = store.state && store.state.data;
  if (!data) {
    toast("Nothing to export yet.", "error");
    return;
  }
  try {
    store.download("crew-log.json", JSON.stringify(data, null, 2), "application/json");
  } catch {
    toast("Could not export JSON.", "error");
  }
}

function exportCSV() {
  try {
    const jobs = store.filterJobs(readFilters(params())) || [];
    store.download("crew-log.csv", store.jobsToCSV(jobs), "text/csv");
  } catch {
    toast("Could not export CSV.", "error");
  }
}

function closeExport() {
  $("export-menu").hidden = true;
  $("export-btn").setAttribute("aria-expanded", "false");
}

function openExport() {
  const menu = $("export-menu");
  menu.hidden = false;
  $("export-btn").setAttribute("aria-expanded", "true");
  const first = menu.querySelector("[role='menuitem']");
  if (first) first.focus();
}

function openModal() {
  if (modalOpen) return;
  closeExport();
  modalReturn = document.activeElement;
  modalOpen = true;
  const root = $("settings-modal");
  root.hidden = false;
  root.setAttribute("aria-hidden", "false");
  $("token-input").value = "";
  syncInert();
  $("token-input").focus();
}

function closeModal() {
  if (!modalOpen) return;
  modalOpen = false;
  const root = $("settings-modal");
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");
  $("token-input").value = "";
  syncInert();
  const back = modalReturn;
  modalReturn = null;
  if (back && typeof back.focus === "function" && document.contains(back)) back.focus();
}

async function onSaveToken(event) {
  event.preventDefault();
  const input = $("token-input");
  const token = input.value.trim();
  input.value = "";
  if (!token) {
    toast("Paste a token first.", "error");
    return;
  }
  try {
    store.setToken(token);
  } catch {
    toast("Could not save the token.", "error");
    return;
  }
  closeModal();
  try {
    await store.init();
  } catch {
    toast("Could not load the crew log.", "error");
  }
}

async function onClearToken() {
  $("token-input").value = "";
  try {
    store.clearToken();
  } catch {
    toast("Could not clear the token.", "error");
    return;
  }
  closeModal();
  try {
    await store.init();
  } catch {
    toast("Could not load the crew log.", "error");
  }
}

function focusable(root) {
  return [...root.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((node) => !node.closest("[hidden]") && node.getAttribute("aria-hidden") !== "true");
}

function trapTab(event, layer) {
  const nodes = focusable(layer);
  if (!nodes.length) {
    event.preventDefault();
    layer.focus();
    return;
  }
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const active = document.activeElement;
  if (!layer.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function onKeydown(event) {
  if (event.key === "Tab") {
    const layer = modalOpen ? $("settings-dialog") : (!$("drawer-root").hidden ? $("drawer") : null);
    if (layer) trapTab(event, layer);
    return;
  }
  if (event.key === "Escape") {
    if (!$("export-menu").hidden) {
      closeExport();
      $("export-btn").focus();
      return;
    }
    if (modalOpen) {
      closeModal();
      return;
    }
    if (!$("drawer-root").hidden) {
      closeJob();
      return;
    }
    if (document.activeElement === $("search-input")) $("search-input").blur();
    return;
  }
  if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
    const target = event.target;
    const tag = target && target.tagName;
    const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (target && target.isContentEditable);
    if (typing || modalOpen || !$("drawer-root").hidden || !$("export-menu").hidden) return;
    event.preventDefault();
    const search = $("search-input");
    search.focus();
    search.select();
  }
}

function bindEvents() {
  document.querySelectorAll(".tabs-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.view;
      go({
        view: id === "board" ? null : id,
        job: null,
        m: null,
      });
    });
  });

  $("search-input").addEventListener("input", () => {
    const dirty = Boolean($("search-input").value.trim()) || activeFilterCount(params()) > 0;
    $("filters-clear").disabled = !dirty;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      const value = $("search-input").value.trim();
      applyUpdates({ q: value || null }, "replace");
      render();
    }, 200);
  });

  for (const id of ["filter-member", "filter-status", "filter-division", "filter-priority", "filter-tag", "filter-from", "filter-to"]) {
    $(id).addEventListener("change", onFilterChange);
  }

  $("filters-clear").addEventListener("click", () => {
    window.clearTimeout(searchTimer);
    $("search-input").value = "";
    applyUpdates({
      q: null,
      member: null,
      status: null,
      division: null,
      priority: null,
      tag: null,
      from: null,
      to: null,
    }, "replace");
    render();
  });

  $("filters-toggle").addEventListener("click", () => {
    filtersOpen = !filtersOpen;
    $("filters-panel").classList.toggle("is-open", filtersOpen);
    syncFiltersAria();
  });

  $("refresh-btn").addEventListener("click", () => requestRefresh());
  $("settings-btn").addEventListener("click", () => openModal());
  $("banner-settings").addEventListener("click", () => openModal());
  $("export-btn").addEventListener("click", () => {
    if ($("export-menu").hidden) openExport();
    else closeExport();
  });
  $("export-json").addEventListener("click", () => {
    closeExport();
    exportJSON();
  });
  $("export-csv").addEventListener("click", () => {
    closeExport();
    exportCSV();
  });
  $("export-menu").addEventListener("keydown", (event) => {
    const items = [...$("export-menu").querySelectorAll("[role='menuitem']")];
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1 + items.length) % items.length].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length].focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0].focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1].focus();
    }
  });

  $("drawer-close").addEventListener("click", () => closeJob());
  $("drawer-backdrop").addEventListener("click", () => closeJob());
  $("modal-close").addEventListener("click", () => closeModal());
  $("modal-backdrop").addEventListener("click", () => closeModal());
  $("settings-form").addEventListener("submit", onSaveToken);
  $("clear-token").addEventListener("click", onClearToken);

  document.addEventListener("keydown", onKeydown);
  document.addEventListener("pointerdown", (event) => {
    const wrap = $("export-wrap");
    if (!$("export-menu").hidden && wrap && !wrap.contains(event.target)) closeExport();
  });
  window.addEventListener("popstate", () => {
    window.clearTimeout(searchTimer);
    fromHistory = true;
    render();
    fromHistory = false;
  });
  window.addEventListener("resize", () => {
    placeIndicator();
    syncFiltersAria();
    syncTopbarHeight();
  });
  const filtersMq = window.matchMedia("(min-width: 721px)");
  if (filtersMq.addEventListener) filtersMq.addEventListener("change", syncFiltersAria);
  if (window.ResizeObserver) {
    const track = $("tabs-track");
    const bar = document.querySelector(".topbar");
    const observer = new ResizeObserver(() => {
      placeIndicator();
      syncTopbarHeight();
    });
    if (track) observer.observe(track);
    if (bar) observer.observe(bar);
  }
}

async function start() {
  bootTheme();
  bindEvents();
  syncTopbarHeight();
  placeIndicator();
  try {
    store.subscribe((state) => {
      try {
        noteState(state || {});
      } catch {
        toast("Could not refresh the view.", "error");
      }
    });
  } catch {
    toast("Could not load the crew log.", "error");
  }
  try {
    await store.init();
  } catch {
    toast("Could not load the crew log.", "error");
  }
  updatesReady = true;
  window.addEventListener("focus", () => requestRefresh());
  window.setInterval(() => requestRefresh(), 60000);
  render();
}

start();
