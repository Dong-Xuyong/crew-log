import { PRIORITY_LABEL, STATUS_LABEL, division as findDivision, member as findMember } from "./store.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const AVATAR_PX = { xs: 20, sm: 28, md: 36, lg: 56, xl: 96 };

export const DIVISION_COLOR = {
  command: "var(--div-command)",
  ops: "var(--div-ops)",
  career: "var(--div-career)",
  health: "var(--div-health)",
  brand: "var(--div-brand)",
};

const ACTION_ICON = {
  started: "play",
  update: "refresh",
  handoff: "arrow-right",
  blocked: "alert",
  done: "check-circle",
  comment: "message",
};

const ACTION_TINT = {
  started: "var(--st-in_progress, #3b82f6)",
  update: "var(--pr-normal, #3b82f6)",
  handoff: "var(--div-ops, #14b8a6)",
  blocked: "var(--st-blocked, #ef4444)",
  done: "var(--st-complete, #22c55e)",
  comment: "hsl(var(--muted-foreground, 40 8% 36%))",
};

const ICONS = {
  home: [
    ["path", { d: "M3 10.5 12 3l9 7.5" }],
    ["path", { d: "M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" }],
  ],
  search: [
    ["circle", { cx: "11", cy: "11", r: "8" }],
    ["path", { d: "m21 21-4.3-4.3" }],
  ],
  filter: [["path", { d: "M22 3H2l8 9.46V19l4 2v-8.54L22 3z" }]],
  settings: [
    ["path", { d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" }],
    ["circle", { cx: "12", cy: "12", r: "3" }],
  ],
  board: [
    ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }],
    ["path", { d: "M9 3v18" }],
    ["path", { d: "M15 3v18" }],
  ],
  list: [
    ["path", { d: "M8 6h13" }],
    ["path", { d: "M8 12h13" }],
    ["path", { d: "M8 18h13" }],
    ["path", { d: "M3 6h.01" }],
    ["path", { d: "M3 12h.01" }],
    ["path", { d: "M3 18h.01" }],
  ],
  users: [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }],
    ["circle", { cx: "9", cy: "7", r: "4" }],
    ["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87" }],
    ["path", { d: "M16 3.13a4 4 0 0 1 0 7.75" }],
  ],
  org: [
    ["rect", { x: "9", y: "3", width: "6", height: "5", rx: "1" }],
    ["rect", { x: "3", y: "16", width: "6", height: "5", rx: "1" }],
    ["rect", { x: "15", y: "16", width: "6", height: "5", rx: "1" }],
    ["path", { d: "M12 8v3" }],
    ["path", { d: "M12 11H6v5" }],
    ["path", { d: "M12 11h6v5" }],
  ],
  calendar: [
    ["rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }],
    ["path", { d: "M16 2v4" }],
    ["path", { d: "M8 2v4" }],
    ["path", { d: "M3 10h18" }],
  ],
  chart: [
    ["path", { d: "M3 3v18h18" }],
    ["path", { d: "M18 17V9" }],
    ["path", { d: "M13 17V5" }],
    ["path", { d: "M8 17v-3" }],
  ],
  download: [
    ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
    ["path", { d: "m7 10 5 5 5-5" }],
    ["path", { d: "M12 15V3" }],
  ],
  x: [
    ["path", { d: "M18 6 6 18" }],
    ["path", { d: "m6 6 12 12" }],
  ],
  link: [
    ["path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }],
    ["path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }],
  ],
  clock: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 6v6l4 2" }],
  ],
  check: [["path", { d: "M20 6 9 17l-5-5" }]],
  "check-circle": [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "m9 12 2 2 4-4" }],
  ],
  alert: [
    ["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }],
    ["path", { d: "M12 9v4" }],
    ["path", { d: "M12 17h.01" }],
  ],
  play: [["path", { d: "M8 5v14l11-7L8 5z" }]],
  "arrow-right": [
    ["path", { d: "M5 12h14" }],
    ["path", { d: "m12 5 7 7-7 7" }],
  ],
  message: [["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }]],
  flag: [
    ["path", { d: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" }],
    ["path", { d: "M4 22v-7" }],
  ],
  refresh: [
    ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }],
    ["path", { d: "M21 3v5h-5" }],
    ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }],
    ["path", { d: "M8 16H3v5" }],
  ],
  user: [
    ["path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }],
    ["circle", { cx: "12", cy: "7", r: "4" }],
  ],
  "chevron-left": [["path", { d: "m15 18-6-6 6-6" }]],
  "chevron-right": [["path", { d: "m9 18 6-6-6-6" }]],
  tag: [
    ["path", { d: "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" }],
    ["circle", { cx: "7.5", cy: "7.5", r: ".5", fill: "currentColor", stroke: "none" }],
  ],
  key: [
    ["path", { d: "M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" }],
    ["circle", { cx: "16.5", cy: "7.5", r: ".5", fill: "currentColor", stroke: "none" }],
  ],
  trash: [
    ["path", { d: "M3 6h18" }],
    ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }],
    ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }],
    ["path", { d: "M10 11v6" }],
    ["path", { d: "M14 11v6" }],
  ],
  sort: [
    ["path", { d: "m3 8 4-4 4 4" }],
    ["path", { d: "M7 4v16" }],
    ["path", { d: "m21 16-4 4-4-4" }],
    ["path", { d: "M17 20V4" }],
  ],
  external: [
    ["path", { d: "M15 3h6v6" }],
    ["path", { d: "M10 14 21 3" }],
    ["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }],
  ],
};

const BOOLEAN_ATTRS = new Set([
  "disabled",
  "checked",
  "selected",
  "hidden",
  "readonly",
  "required",
  "multiple",
  "autofocus",
  "open",
  "controls",
  "loop",
  "muted",
  "autoplay",
  "defer",
  "inert",
  "novalidate",
  "formnovalidate",
  "allowfullscreen",
  "reversed",
  "nomodule",
]);

function doc() {
  if (typeof document === "undefined") throw new Error("document unavailable");
  return document;
}

function isNode(value) {
  return value != null && typeof value === "object" && typeof value.nodeType === "number";
}

function applyStyle(el, value) {
  if (typeof value === "string") {
    el.setAttribute("style", value);
    return;
  }
  if (!value || typeof value !== "object") return;
  const entries = Object.entries(value);
  for (let i = 0; i < entries.length; i += 1) {
    const key = entries[i][0];
    const item = entries[i][1];
    if (item == null || item === false) continue;
    if (key.startsWith("--")) el.style.setProperty(key, String(item));
    else el.style[key] = String(item);
  }
}

function applyProps(el, props) {
  const entries = Object.entries(props || {});
  for (let i = 0; i < entries.length; i += 1) {
    const key = entries[i][0];
    const value = entries[i][1];
    if (value == null) continue;
    if (key === "class") {
      const cls = Array.isArray(value) ? value.filter(Boolean).join(" ") : String(value);
      if (cls) el.setAttribute("class", cls);
      continue;
    }
    if (key === "text" || key === "html") {
      el.textContent = String(value);
      continue;
    }
    if (key === "style") {
      applyStyle(el, value);
      continue;
    }
    if (key === "dataset" && typeof value === "object") {
      const dataEntries = Object.entries(value);
      for (let d = 0; d < dataEntries.length; d += 1) {
        if (dataEntries[d][1] != null) el.dataset[dataEntries[d][0]] = String(dataEntries[d][1]);
      }
      continue;
    }
    if (key === "on" && value && typeof value === "object") {
      const events = Object.entries(value);
      for (let e = 0; e < events.length; e += 1) {
        if (typeof events[e][1] === "function") el.addEventListener(events[e][0], events[e][1]);
      }
      continue;
    }
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2), value);
      continue;
    }
    if (key.startsWith("aria-") && typeof value === "boolean") {
      el.setAttribute(key, value ? "true" : "false");
      continue;
    }
    if (value === false) continue;
    if (value === true) {
      el.setAttribute(key, "");
      continue;
    }
    if (BOOLEAN_ATTRS.has(key)) {
      el.setAttribute(key, String(value));
      continue;
    }
    el.setAttribute(key, String(value));
  }
}

function appendOne(el, child) {
  if (Array.isArray(child)) {
    for (let i = 0; i < child.length; i += 1) appendOne(el, child[i]);
    return;
  }
  if (child == null || child === false) return;
  if (typeof child === "string" || typeof child === "number") {
    el.appendChild(doc().createTextNode(String(child)));
    return;
  }
  if (isNode(child)) el.appendChild(child);
}

export function h(tag, props, ...children) {
  let attrs = props;
  let nodes = children;
  if (props == null || typeof props !== "object" || Array.isArray(props) || isNode(props)) {
    nodes = props === undefined ? children : [props, ...children];
    attrs = {};
  }
  const el = doc().createElement(tag);
  applyProps(el, attrs);
  for (let i = 0; i < nodes.length; i += 1) appendOne(el, nodes[i]);
  return el;
}

function svgAttrs(el, attrs) {
  const entries = Object.entries(attrs);
  for (let i = 0; i < entries.length; i += 1) el.setAttribute(entries[i][0], entries[i][1]);
  return el;
}

export function icon(name, options) {
  const opts = options || {};
  const size = opts.size == null ? 18 : opts.size;
  const label = opts.label ? String(opts.label) : "";
  const svg = doc().createElementNS(SVG_NS, "svg");
  svgAttrs(svg, {
    viewBox: "0 0 24 24",
    width: String(size),
    height: String(size),
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    class: "icon",
    focusable: "false",
  });
  svg.style.width = `${size}px`;
  svg.style.height = `${size}px`;
  if (label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
  } else {
    svg.setAttribute("aria-hidden", "true");
  }
  const shapes = ICONS[name] || ICONS.alert;
  for (let i = 0; i < shapes.length; i += 1) {
    const node = doc().createElementNS(SVG_NS, shapes[i][0]);
    svgAttrs(node, shapes[i][1]);
    svg.appendChild(node);
  }
  return svg;
}

function safeToken(value) {
  const text = String(value || "");
  return /^[a-z0-9_-]+$/i.test(text) ? text : "";
}

function safeAsset(url) {
  if (typeof url !== "string") return "";
  const text = url.trim();
  if (!text || text.includes("\\") || text.includes("..")) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith("//")) return "";
  return text;
}

function initials(name) {
  const parts = String(name || "")
    .replace(/\./g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function asMember(memberOrId) {
  if (memberOrId && typeof memberOrId === "object") return memberOrId;
  if (typeof memberOrId === "string" || typeof memberOrId === "number") {
    const found = findMember(String(memberOrId));
    if (found) return found;
    return { id: String(memberOrId), unknown: true };
  }
  return { id: "", unknown: true };
}

function ringColor(person) {
  if (!person || person.unknown || !person.division) return "#94a3b8";
  return DIVISION_COLOR[person.division] || "#94a3b8";
}

function avatarSources(person) {
  const sources = [];
  const id = safeToken(person.id);
  if (id) sources.push(`assets/avatars/thumb/${id}.webp`);
  const portrait = safeAsset(person.avatar);
  if (portrait && sources.indexOf(portrait) === -1) sources.push(portrait);
  if (id) {
    const png = `assets/avatars/${id}.png`;
    if (sources.indexOf(png) === -1) sources.push(png);
  }
  return sources.filter((src) => !FAILED_SRC.has(src));
}

const FAILED_SRC = new Set();

function letterSpan(text) {
  const letters = doc().createElement("span");
  letters.className = "av-letters";
  letters.textContent = text;
  return letters;
}

export function avatar(memberOrId, options) {
  const opts = options || {};
  const size = AVATAR_PX[opts.size] ? opts.size : "md";
  const px = AVATAR_PX[size];
  const ring = opts.ring !== false;
  const showTitle = opts.title !== false;
  const person = asMember(memberOrId);
  const unknown = !!(person && person.unknown);
  const el = doc().createElement("span");
  const classes = ["av", `av-${size}`];
  if (ring) classes.push("av-ring");
  if (unknown) classes.push("av-unknown");
  if (!unknown && person.status === "paused") classes.push("av-paused");
  el.className = classes.join(" ");
  el.style.setProperty("--av-size", `${px}px`);
  el.style.setProperty("--ring-color", unknown ? "#94a3b8" : ringColor(person));
  if (showTitle) {
    if (unknown) el.title = person.id || "Unknown";
    else if (person.title) el.title = `${person.name || person.id || ""} · ${person.title}`;
    else el.title = person.name || person.id || "";
  }
  let dot = null;
  if (!unknown && person.status === "paused") {
    dot = doc().createElement("span");
    dot.className = "av-dot";
    dot.setAttribute("aria-hidden", "true");
  }
  if (unknown || (!safeToken(person.id) && !safeAsset(person.avatar))) {
    el.appendChild(letterSpan(unknown ? "?" : initials(person.name || person.id)));
    if (dot) el.appendChild(dot);
    return el;
  }
  const sources = avatarSources(person);
  if (!sources.length) {
    el.appendChild(letterSpan(initials(person.name || person.id)));
    if (dot) el.appendChild(dot);
    return el;
  }
  const img = doc().createElement("img");
  img.className = "av-img";
  img.alt = person.name || person.id || "";
  img.width = px;
  img.height = px;
  img.loading = "lazy";
  img.decoding = "async";
  let step = 0;
  let settled = false;
  const useLetters = () => {
    if (settled) return;
    settled = true;
    img.removeEventListener("error", onError);
    if (img.parentNode) img.remove();
    const letters = letterSpan(initials(person.name || person.id));
    if (dot && dot.parentNode === el) el.insertBefore(letters, dot);
    else el.appendChild(letters);
  };
  const onError = () => {
    if (settled) return;
    FAILED_SRC.add(sources[step]);
    step += 1;
    if (step < sources.length) {
      img.src = sources[step];
      if (img.complete && img.naturalWidth === 0) onError();
      return;
    }
    useLetters();
  };
  el.appendChild(img);
  if (dot) el.appendChild(dot);
  img.addEventListener("error", onError);
  img.src = sources[0];
  if (!settled && img.complete && img.naturalWidth === 0) onError();
  return el;
}

export function avatarStack(ids, options) {
  const opts = options || {};
  const max = opts.max == null ? 4 : opts.max;
  const size = opts.size || "sm";
  const list = Array.isArray(ids) ? ids : [];
  const limit = Number.isFinite(Number(max)) ? Math.max(0, Number(max)) : 4;
  const shown = list.slice(0, limit);
  const extra = list.length - shown.length;
  const stack = doc().createElement("span");
  stack.className = "av-stack";
  for (let i = 0; i < shown.length; i += 1) {
    stack.appendChild(avatar(shown[i], { size, ring: true, title: true }));
  }
  if (extra > 0) {
    const bubble = doc().createElement("span");
    bubble.className = `av av-${AVATAR_PX[size] ? size : "sm"} av-more`;
    bubble.textContent = `+${extra}`;
    bubble.title = `${extra} more`;
    bubble.setAttribute("aria-label", `${extra} more`);
    stack.appendChild(bubble);
  }
  return stack;
}

export function statusChip(status) {
  const key = safeToken(status);
  const known = !!(key && STATUS_LABEL[key]);
  return h("span", {
    class: ["chip", "chip-status", known ? `chip-st-${key}` : "chip-st-unknown"],
    text: STATUS_LABEL[status] || (status ? String(status) : "Unknown"),
  });
}

export function priorityChip(priority) {
  const key = safeToken(priority);
  const known = !!(key && PRIORITY_LABEL[key]);
  return h("span", {
    class: ["chip", "chip-priority", known ? `chip-pr-${key}` : "chip-pr-unknown"],
    text: PRIORITY_LABEL[priority] || (priority ? String(priority) : "Unknown"),
  });
}

export function tagChip(tag) {
  return h("span", { class: "tag", text: tag == null ? "" : String(tag) });
}

export function divisionBadge(divisionId) {
  const record = divisionId ? findDivision(divisionId) : undefined;
  const key = safeToken(divisionId);
  const known = !!(key && (DIVISION_COLOR[key] || record));
  const label = record && record.name ? record.name : (divisionId ? String(divisionId) : "—");
  return h("span", {
    class: ["div-badge", known ? `div-badge-${key}` : "div-badge-unknown"],
    text: label,
  });
}

export function actionIcon(action) {
  const node = icon(ACTION_ICON[action] || "message", { size: 16 });
  if (ACTION_TINT[action]) node.style.color = ACTION_TINT[action];
  return node;
}

export function empty(text, iconName = "board") {
  return h(
    "div",
    { class: "empty" },
    icon(iconName || "board", { size: 28 }),
    h("p", { class: "empty-text", text: text == null ? "" : String(text) }),
  );
}

export function clear(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}
