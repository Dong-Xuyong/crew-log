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

function isRootMember(member) {
  return member.reportsTo == null || member.reportsTo === "";
}

function asMember(store, item) {
  if (!item) return null;
  if (typeof item === "string") return store.member(item) || { id: item, name: item };
  if (item.id) return item;
  return null;
}

export function render(root, ctx) {
  const { store, ui } = ctx;
  const { h } = ui;
  const members = (store.members() || []).filter((member) => member && member.id);
  if (!members.length) {
    root.append(h("div", { class: "org" }, ui.empty("No crew to chart yet.", "org")));
    return;
  }

  const seen = new Set();
  const roots = members.filter(isRootMember);
  const trees = roots.map((member) => buildNode(store, member, 0, seen)).filter(Boolean);
  const unassigned = members.filter((member) => !seen.has(member.id));

  const parts = [];
  if (trees.length) {
    parts.push(h("div", { class: "org-desktop" },
      h("div", { class: "org-scroll" },
        h("ul", { class: "org-tree", "aria-label": "Organization chart" },
          trees.map((node) => desktopItem(h, ctx, node))
        )
      )
    ));
    parts.push(h("div", { class: "org-mobile" },
      h("ul", { class: "org-ol", "aria-label": "Organization chart" },
        trees.map((node) => mobileItem(h, ctx, node))
      )
    ));
  }
  if (unassigned.length) {
    parts.push(h("section", { class: "org-loose" },
      h("h2", { class: "org-loose-title", text: "Unassigned" }),
      h("ul", { class: "org-loose-list" }, unassigned.map((member) => h("li", { class: "org-loose-item" },
        orgNode(h, ctx, member, false)
      )))
    ));
  }
  root.append(h("div", { class: "org" }, parts));
}

function buildNode(store, member, depth, seen) {
  const person = asMember(store, member);
  if (!person || !person.id || seen.has(person.id)) return null;
  seen.add(person.id);
  const children = [];
  for (const item of store.directReports(person.id) || []) {
    const child = buildNode(store, item, depth + 1, seen);
    if (child) children.push(child);
  }
  return { member: person, depth, children };
}

function childListClass(depth, count) {
  if (depth === 0 && count <= 6) return "org-children";
  if (count > 4) return "org-stack org-stack-grid";
  return "org-stack";
}

function desktopItem(h, ctx, node) {
  const kids = node.children;
  return h("li", { class: "org-li" },
    orgNode(h, ctx, node.member, node.depth === 0),
    kids.length
      ? h("ul", { class: childListClass(node.depth, kids.length) }, kids.map((child) => desktopItem(h, ctx, child)))
      : null
  );
}

function mobileItem(h, ctx, node) {
  const button = orgNode(h, ctx, node.member, node.depth === 0);
  if (!node.children.length) return h("li", { class: "org-ol-item" }, button);
  const count = node.children.length;
  const details = h("details", { class: "org-details" },
    h("summary", { class: "org-more" },
      h("span", { class: "org-twist", "aria-hidden": "true" }),
      h("span", { class: "org-more-label", text: `${count} direct report${count === 1 ? "" : "s"}` })
    ),
    h("ul", { class: "org-ol" }, node.children.map((child) => mobileItem(h, ctx, child)))
  );
  if (node.depth < 1) details.open = true;
  return h("li", { class: "org-ol-item" }, button, details);
}

function orgNode(h, ctx, member, root) {
  const { ui, store, now, openMember } = ctx;
  const open = num((store.memberStats(member.id, now) || {}).open);
  const paused = member.status === "paused";
  return h("button", {
    type: "button",
    class: cx("org-node", root && "org-root", paused && "org-paused"),
    "data-division": member.division || "",
    "data-member": member.id,
    on: { click: () => openMember(member.id) }
  },
    h("span", { class: "org-node-av", "aria-hidden": "true" }, ui.avatar(member, { size: "md", ring: true })),
    h("span", { class: "org-node-text" },
      h("span", { class: "org-node-name", text: displayName(member) }),
      member.title ? h("span", { class: "org-node-title", text: member.title }) : null,
      paused ? h("span", { class: "org-flag", text: "Paused" }) : null
    ),
    open > 0
      ? h("span", { class: "org-badge", title: `${open} open jobs` },
        h("span", { text: String(open) }),
        h("span", { class: "org-sr", text: " open jobs" })
      )
      : null
  );
}
