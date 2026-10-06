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

export function render(root, ctx) {
  const { store, ui, params, now, go, openMember } = ctx;
  const { h } = ui;
  const members = (store.members() || []).filter((member) => member && member.id);
  const divisions = store.divisions() || [];
  const selected = params.get("div") || "";
  const counts = new Map();
  for (const member of members) {
    const key = member.division || "";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const chips = [
    divisionChip(h, go, {
      id: "",
      name: "All",
      count: members.length,
      pressed: selected === ""
    })
  ];
  for (const division of divisions) {
    if (!division || !division.id) continue;
    chips.push(divisionChip(h, go, {
      id: division.id,
      name: division.name || division.id,
      count: counts.get(division.id) || 0,
      pressed: selected === division.id
    }));
  }

  const shown = selected ? members.filter((member) => member.division === selected) : members;
  root.append(h("div", { class: "members" },
    h("div", { class: "members-filters", role: "group", "aria-label": "Filter by division" }, chips),
    shown.length
      ? h("ul", { class: "members-grid" }, shown.map((member) => h("li", { class: "members-item" },
        memberCard(h, ui, store, member, now, openMember)
      )))
      : ui.empty(selected ? "No one in this division." : "No crew members yet.", "users")
  ));
}

function divisionChip(h, go, { id, name, count, pressed }) {
  return h("button", {
    type: "button",
    class: "members-chip",
    "aria-pressed": pressed ? "true" : "false",
    on: { click: () => go({ div: id || null }) }
  },
    id ? h("span", { class: "members-dot", "data-division": id, "aria-hidden": "true" }) : null,
    h("span", { class: "members-chip-label", text: name }),
    h("span", { class: "members-chip-count", text: String(count) })
  );
}

function memberCard(h, ui, store, member, now, openMember) {
  const stats = store.memberStats(member.id, now) || {};
  const open = num(stats.open);
  const done7 = num(stats.done7);
  const paused = member.status === "paused";
  const oneJob = String(member.oneJob || "").trim();
  return h("button", {
    type: "button",
    class: cx("mcard", paused && "mcard-paused"),
    "data-division": member.division || "",
    "data-member": member.id,
    on: { click: () => openMember(member.id) }
  },
    h("div", { class: "mcard-band", "aria-hidden": "true" }),
    h("div", { class: "mcard-main" },
      h("div", { class: "mcard-avatar", "aria-hidden": "true" }, ui.avatar(member, { size: "lg", ring: true })),
      h("h3", { class: "mcard-name", text: displayName(member) }),
      h("p", { class: "mcard-title", text: member.title || "" }),
      h("div", { class: "mcard-badges" },
        member.division ? ui.divisionBadge(member.division) : null,
        paused ? h("span", { class: "mcard-flag", text: "Paused" }) : null
      ),
      h("div", { class: "mcard-onejob" },
        h("span", { class: "mcard-onejob-label", text: "ONE JOB" }),
        oneJob
          ? h("p", { class: "mcard-onejob-text", text: oneJob })
          : h("p", { class: "mcard-onejob-text mcard-empty", text: "Not set yet" })
      ),
      reportsTo(h, ui, store, member),
      h("div", { class: "mcard-stats" },
        stat(h, open, "Open"),
        stat(h, done7, "Done 7d")
      )
    )
  );
}

function reportsTo(h, ui, store, member) {
  if (!member.reportsTo) {
    return h("div", { class: "mcard-reports" },
      h("span", { class: "mcard-reports-k", text: "Reports to" }),
      h("span", { class: "mcard-reports-who" },
        h("span", { class: "mcard-rootmark", "aria-hidden": "true" }, ui.icon("user", { size: 12 })),
        h("span", { class: "mcard-reports-name", text: "Crew root" })
      )
    );
  }
  const boss = store.member(member.reportsTo) || { id: member.reportsTo, name: member.reportsTo };
  return h("div", { class: "mcard-reports" },
    h("span", { class: "mcard-reports-k", text: "Reports to" }),
    h("span", { class: "mcard-reports-who" },
      h("span", { "aria-hidden": "true" }, ui.avatar(boss, { size: "xs", ring: true })),
      h("span", { class: "mcard-reports-name", text: displayName(boss) })
    )
  );
}

function stat(h, value, label) {
  return h("span", { class: "mcard-stat" },
    h("span", { class: "mcard-stat-num", text: String(value) }),
    h("span", { class: "mcard-stat-label", text: label })
  );
}
