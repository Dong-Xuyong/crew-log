const NOW = new Date();

function pad(n) {
  return String(n).padStart(2, "0");
}

function lisbonParts(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  if (parts.hour === "24") parts.hour = "00";
  return parts;
}

function offsetMinutes(date) {
  const parts = lisbonParts(date);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

function formatOffset(minutes) {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  return sign + pad(Math.floor(abs / 60)) + ":" + pad(abs % 60);
}

function ymdShift(days) {
  const parts = lisbonParts(new Date(NOW.getTime() + days * 86400000));
  return parts.year + "-" + parts.month + "-" + parts.day;
}

function isoDaysAgo(n, hour = 9, minute = 0) {
  const ymd = ymdShift(-n);
  const [year, month, day] = ymd.split("-").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute, 0);
  let offset = offsetMinutes(new Date(wall));
  offset = offsetMinutes(new Date(wall - offset * 60000));
  return ymd + "T" + pad(hour) + ":" + pad(minute) + ":00" + formatOffset(offset);
}

function ymdDaysAgo(n) {
  return ymdShift(-n);
}

function ymdDaysAhead(n) {
  return ymdShift(n);
}

function jobId(createdAt, suffix) {
  return "job_" + createdAt.slice(0, 10).replaceAll("-", "") + "_" + suffix;
}

function entry(id, at, memberId, action, text, links = []) {
  return { id, at, memberId, action, text, links };
}

function link(label, url) {
  return { label, url };
}

function makeJob(job) {
  const entries = job.log;
  return {
    id: job.id,
    title: job.title,
    requester: "dong",
    assignees: job.assignees,
    lead: job.lead,
    division: job.division,
    status: job.status,
    priority: job.priority,
    tags: job.tags,
    createdAt: job.createdAt,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
    due: job.due ?? null,
    description: job.description,
    result: job.result ?? "",
    links: job.links ?? [],
    log: entries,
    subtasks: job.subtasks ?? [],
    parentJobId: job.parentJobId ?? null,
    updatedAt: entries[entries.length - 1].at,
  };
}

const iceCreated = isoDaysAgo(3, 9, 10);
const iceJobId = jobId(iceCreated, "ship");
const avatarCreated = isoDaysAgo(2, 10, 5);

export const DEMO_JOBS = [
  makeJob({
    id: jobId(avatarCreated, "avtr"),
    title: "EXAMPLE · Crew avatars",
    assignees: ["perona", "uta", "franky"],
    lead: "perona",
    division: "brand",
    status: "in_progress",
    priority: "high",
    tags: ["avatars", "brand"],
    createdAt: avatarCreated,
    startedAt: isoDaysAgo(2, 11, 0),
    due: ymdDaysAhead(4),
    description: "Dong asked Perona to draw a 1024px portrait for every crew member.",
    links: [link("Avatar board", "https://example.com/avatars")],
    parentJobId: iceJobId,
    subtasks: [
      { id: "st_pa01", title: "Draw the command portraits", memberId: "perona", done: true },
      { id: "st_pa02", title: "Draw the ops portraits", memberId: "perona", done: false },
      { id: "st_pa03", title: "Check contrast on the dark theme", memberId: "franky", done: false },
    ],
    log: [
      entry(
        "log_pa01",
        isoDaysAgo(2, 11, 0),
        "perona",
        "started",
        "status -> in_progress. Perona opened the portrait board and exported the first file to assets/avatars/luffy.png."
      ),
      entry(
        "log_pa02",
        isoDaysAgo(1, 13, 40),
        "perona",
        "update",
        "Perona drew nami.png and zoro.png at 1024px and saved both under assets/avatars/.",
        [link("luffy.png", "https://example.com/avatars/luffy.png")]
      ),
      entry(
        "log_pa03",
        isoDaysAgo(1, 17, 5),
        "perona",
        "handoff",
        "Perona handed the dark-theme contrast check to Franky."
      ),
      entry(
        "log_pa04",
        isoDaysAgo(0, 9, 30),
        "franky",
        "comment",
        "Franky checked the straw-hat mark at 28px and asked for more padding so the ring does not clip."
      ),
      entry(
        "log_pa05",
        isoDaysAgo(0, 16, 45),
        "uta",
        "update",
        "Uta approved the command colors and told Perona to keep the division ring on every portrait."
      ),
    ],
  }),
  makeJob({
    id: jobId(isoDaysAgo(13, 9, 0), "clck"),
    title: "EXAMPLE · Life OS ClickUp",
    assignees: ["robin", "nami"],
    lead: "robin",
    division: "ops",
    status: "complete",
    priority: "normal",
    tags: ["clickup", "life-os"],
    createdAt: isoDaysAgo(13, 9, 0),
    startedAt: isoDaysAgo(13, 9, 30),
    completedAt: isoDaysAgo(12, 16, 40),
    due: ymdDaysAgo(12),
    description: "Dong asked Robin to set up the Life OS space in ClickUp and map the daily fields.",
    result: "Life OS space is live, with day, week, and month lists mapped to the journal fields.",
    links: [link("Life OS space", "https://example.com/life-os")],
    subtasks: [
      { id: "st_rb01", title: "Create the Life OS space", memberId: "robin", done: true },
      { id: "st_rb02", title: "Map daily fields to lists", memberId: "robin", done: true },
    ],
    log: [
      entry(
        "log_rb01",
        isoDaysAgo(13, 9, 30),
        "robin",
        "started",
        "status -> in_progress. Robin created the Life OS space and named the day, week, and month lists.",
        [link("Life OS space", "https://example.com/life-os")]
      ),
      entry(
        "log_rb02",
        isoDaysAgo(13, 14, 0),
        "robin",
        "update",
        "Robin mapped mood, energy, focus, and grateful onto the day list."
      ),
      entry(
        "log_rb03",
        isoDaysAgo(12, 10, 15),
        "robin",
        "handoff",
        "Robin handed the field check to Nami."
      ),
      entry(
        "log_rb04",
        isoDaysAgo(12, 15, 0),
        "nami",
        "update",
        "Nami compared the lists with the journal fields and found three missing week fields.",
        [link("Field map", "https://example.com/life-os/fields")]
      ),
      entry(
        "log_rb05",
        isoDaysAgo(12, 16, 40),
        "robin",
        "done",
        "status -> complete. Robin added the missing week fields and closed the Life OS setup."
      ),
    ],
  }),
  makeJob({
    id: jobId(isoDaysAgo(10, 8, 30), "caln"),
    title: "EXAMPLE · Calendar sync",
    assignees: ["jinbe", "shakky", "pell"],
    lead: "jinbe",
    division: "ops",
    status: "complete",
    priority: "high",
    tags: ["calendar"],
    createdAt: isoDaysAgo(10, 8, 30),
    startedAt: isoDaysAgo(10, 9, 0),
    completedAt: isoDaysAgo(8, 16, 10),
    due: ymdDaysAgo(8),
    description: "Dong asked Jinbe to sync the Life OS dates onto the shared calendar.",
    result: "The shared calendar holds the next 30 days of briefs, meals, and speaking drills.",
    links: [link("Calendar", "https://example.com/calendar")],
    log: [
      entry(
        "log_jb01",
        isoDaysAgo(10, 9, 0),
        "jinbe",
        "started",
        "status -> in_progress. Jinbe connected the shared calendar and pulled the next 30 days."
      ),
      entry(
        "log_jb02",
        isoDaysAgo(9, 11, 20),
        "jinbe",
        "update",
        "Jinbe added brief, meal, and speaking events onto the calendar.",
        [link("Calendar", "https://example.com/calendar")]
      ),
      entry(
        "log_jb03",
        isoDaysAgo(9, 13, 0),
        "shakky",
        "comment",
        "Shakky checked that WhatsApp reminders match the 08:00 brief slot."
      ),
      entry(
        "log_jb04",
        isoDaysAgo(8, 10, 45),
        "pell",
        "update",
        "Pell mirrored the same events into the Telegram reminder list."
      ),
      entry(
        "log_jb05",
        isoDaysAgo(8, 16, 10),
        "jinbe",
        "done",
        "status -> complete. Jinbe confirmed the calendar matches the Life OS dates."
      ),
    ],
  }),
  makeJob({
    id: jobId(isoDaysAgo(0, 8, 0), "brif"),
    title: "EXAMPLE · Morning brief",
    assignees: ["haredas", "nami"],
    lead: "haredas",
    division: "ops",
    status: "todo",
    priority: "low",
    tags: ["brief"],
    createdAt: isoDaysAgo(0, 8, 0),
    due: ymdDaysAhead(2),
    description: "Dong asked Haredas for a one-page morning brief: calendar, weather, and the top three jobs.",
    log: [
      entry(
        "log_hd01",
        isoDaysAgo(0, 8, 25),
        "nami",
        "comment",
        "Nami noted the brief should arrive before 08:00 PT and should list overdue jobs."
      ),
      entry(
        "log_hd02",
        isoDaysAgo(0, 8, 50),
        "haredas",
        "comment",
        "Haredas wrote the outline: calendar, weather, and the top three jobs."
      ),
      entry(
        "log_hd03",
        isoDaysAgo(0, 9, 15),
        "luffy",
        "comment",
        "Luffy asked Haredas to flag blocked work before the brief goes to Dong."
      ),
    ],
  }),
  makeJob({
    id: jobId(isoDaysAgo(7, 9, 0), "mand"),
    title: "EXAMPLE · Mandarin flashcards",
    assignees: ["rayleigh", "brook", "nami"],
    lead: "rayleigh",
    division: "ops",
    status: "review",
    priority: "normal",
    tags: ["mandarin", "flashcards"],
    createdAt: isoDaysAgo(7, 9, 0),
    startedAt: isoDaysAgo(6, 10, 0),
    due: ymdDaysAhead(1),
    description: "Dong asked Rayleigh to rebuild this week's Mandarin deck and record Brook reading the tones.",
    links: [link("Deck", "https://example.com/mandarin/deck")],
    log: [
      entry(
        "log_ry01",
        isoDaysAgo(6, 10, 0),
        "rayleigh",
        "started",
        "status -> in_progress. Rayleigh opened a new weekly deck and added the first 20 cards."
      ),
      entry(
        "log_ry02",
        isoDaysAgo(5, 15, 30),
        "rayleigh",
        "update",
        "Rayleigh finished 40 cards with pinyin, tone marks, and example sentences.",
        [link("Deck", "https://example.com/mandarin/deck")]
      ),
      entry(
        "log_ry03",
        isoDaysAgo(3, 18, 0),
        "brook",
        "update",
        "Brook recorded the tone audio for the 40 cards and attached the clips to the deck."
      ),
      entry(
        "log_ry04",
        isoDaysAgo(1, 11, 0),
        "rayleigh",
        "handoff",
        "Rayleigh handed the deck to Nami for review."
      ),
      entry(
        "log_ry05",
        isoDaysAgo(0, 18, 20),
        "nami",
        "update",
        "status -> review. Nami queued the deck for Dong's evening pass."
      ),
    ],
  }),
  makeJob({
    id: jobId(isoDaysAgo(8, 9, 20), "thes"),
    title: "EXAMPLE · Thesis literature review",
    assignees: ["ace", "robin"],
    lead: "ace",
    division: "ops",
    status: "blocked",
    priority: "urgent",
    tags: ["thesis", "literature"],
    createdAt: isoDaysAgo(8, 9, 20),
    startedAt: isoDaysAgo(7, 10, 10),
    due: ymdDaysAgo(4),
    description: "Dong asked Ace to draft the literature review section and file the source notes.",
    links: [link("Source list", "https://example.com/thesis/literature")],
    subtasks: [
      { id: "st_ac01", title: "File notes for the first eight papers", memberId: "ace", done: true },
      { id: "st_ac02", title: "Draft the literature review section", memberId: "ace", done: false },
    ],
    log: [
      entry(
        "log_ac01",
        isoDaysAgo(7, 10, 10),
        "ace",
        "started",
        "status -> in_progress. Ace opened the literature folder and listed the papers Dong marked."
      ),
      entry(
        "log_ac02",
        isoDaysAgo(5, 16, 0),
        "ace",
        "update",
        "Ace filed notes for the first eight papers in the thesis source list.",
        [link("Source list", "https://example.com/thesis/literature")]
      ),
      entry(
        "log_ac03",
        isoDaysAgo(3, 12, 30),
        "robin",
        "update",
        "Robin added two missing citations and linked them from the source list."
      ),
      entry(
        "log_ac04",
        isoDaysAgo(1, 14, 45),
        "ace",
        "blocked",
        "status -> blocked. Ace stopped because the library login at the source list rejected the session.",
        [link("Source list", "https://example.com/thesis/literature")]
      ),
      entry(
        "log_ac05",
        isoDaysAgo(1, 17, 20),
        "robin",
        "comment",
        "Robin asked Dong for a fresh library login before Ace continues."
      ),
    ],
  }),
  makeJob({
    id: jobId(isoDaysAgo(6, 8, 40), "meal"),
    title: "EXAMPLE · Week meal plan",
    assignees: ["streusen", "sanji", "chopper"],
    lead: "streusen",
    division: "health",
    status: "complete",
    priority: "normal",
    tags: ["nutrition", "meals"],
    createdAt: isoDaysAgo(6, 8, 40),
    startedAt: isoDaysAgo(5, 9, 10),
    completedAt: isoDaysAgo(4, 17, 55),
    due: ymdDaysAgo(4),
    description: "Dong asked Streusen for a 7-day meal plan that matches this week's training.",
    result: "Seven-day meal plan is filed, and Chopper signed off the protein targets.",
    links: [link("Meal plan", "https://example.com/meals/week")],
    subtasks: [
      { id: "st_me01", title: "Draft seven days of meals", memberId: "streusen", done: true },
      { id: "st_me02", title: "Sign off protein targets", memberId: "chopper", done: true },
    ],
    log: [
      entry(
        "log_me01",
        isoDaysAgo(5, 9, 10),
        "streusen",
        "started",
        "status -> in_progress. Streusen started a 7-day meal plan from this week's training load."
      ),
      entry(
        "log_me02",
        isoDaysAgo(5, 15, 0),
        "streusen",
        "update",
        "Streusen drafted breakfast, lunch, and dinner for all seven days."
      ),
      entry(
        "log_me03",
        isoDaysAgo(4, 10, 0),
        "streusen",
        "handoff",
        "Streusen handed the protein targets to Chopper."
      ),
      entry(
        "log_me04",
        isoDaysAgo(4, 13, 20),
        "chopper",
        "update",
        "Chopper checked the protein targets and signed off each day.",
        [link("Meal plan", "https://example.com/meals/week")]
      ),
      entry(
        "log_me05",
        isoDaysAgo(4, 15, 40),
        "sanji",
        "update",
        "Sanji swapped Thursday dinner for a faster prep and updated the plan."
      ),
      entry(
        "log_me06",
        isoDaysAgo(4, 17, 55),
        "streusen",
        "done",
        "status -> complete. Streusen filed the week plan with Chopper's sign-off."
      ),
    ],
  }),
  makeJob({
    id: jobId(isoDaysAgo(5, 11, 0), "spok"),
    title: "EXAMPLE · Speaking drill",
    assignees: ["usopp", "zoro"],
    lead: "usopp",
    division: "career",
    status: "in_progress",
    priority: "high",
    tags: ["speaking"],
    createdAt: isoDaysAgo(5, 11, 0),
    startedAt: isoDaysAgo(4, 9, 30),
    due: ymdDaysAgo(2),
    description: "Dong asked Usopp to run a 3-minute speaking drill and score it on structure and delivery.",
    links: [link("Drill notes", "https://example.com/speaking/drill")],
    subtasks: [
      { id: "st_sp01", title: "Record the 3-minute drill", memberId: "usopp", done: true },
      { id: "st_sp02", title: "Score structure and delivery", memberId: "zoro", done: false },
    ],
    log: [
      entry(
        "log_us01",
        isoDaysAgo(4, 9, 30),
        "usopp",
        "started",
        "status -> in_progress. Usopp set up a 3-minute speaking drill on structure and delivery."
      ),
      entry(
        "log_us02",
        isoDaysAgo(3, 16, 15),
        "usopp",
        "update",
        "Usopp recorded the first take and wrote timing notes.",
        [link("Drill notes", "https://example.com/speaking/drill")]
      ),
      entry(
        "log_us03",
        isoDaysAgo(2, 12, 0),
        "zoro",
        "comment",
        "Zoro marked the opening as unclear and asked for a second take."
      ),
      entry(
        "log_us04",
        isoDaysAgo(0, 11, 25),
        "usopp",
        "update",
        "Usopp recorded a second take and saved the notes at https://example.com/speaking/drill."
      ),
    ],
  }),
  makeJob({
    id: iceJobId,
    title: "EXAMPLE · Ship Crew Log",
    assignees: ["iceburg", "luffy", "clover"],
    lead: "iceburg",
    division: "command",
    status: "complete",
    priority: "urgent",
    tags: ["crew-log", "github-pages"],
    createdAt: iceCreated,
    startedAt: isoDaysAgo(3, 10, 0),
    completedAt: isoDaysAgo(1, 18, 5),
    due: ymdDaysAgo(1),
    description: "Dong asked Iceburg to ship the Crew Log app as a read-only GitHub Pages site.",
    result: "Crew Log is ready as a read-only GitHub Pages app with a labeled demo mode.",
    links: [link("Crew Log", "https://example.com/crew-log")],
    subtasks: [
      { id: "st_ic01", title: "Build the read-only shell and views", memberId: "iceburg", done: true },
      { id: "st_ic02", title: "Check the data shape", memberId: "clover", done: true },
    ],
    log: [
      entry(
        "log_ic01",
        isoDaysAgo(3, 10, 0),
        "iceburg",
        "started",
        "status -> in_progress. Iceburg created the Crew Log shell and the read-only board."
      ),
      entry(
        "log_ic02",
        isoDaysAgo(2, 14, 20),
        "iceburg",
        "update",
        "Iceburg added list, members, and the job drawer, with no edit controls."
      ),
      entry(
        "log_ic03",
        isoDaysAgo(2, 16, 0),
        "iceburg",
        "handoff",
        "Iceburg handed the data-shape check to Clover."
      ),
      entry(
        "log_ic04",
        isoDaysAgo(1, 11, 30),
        "clover",
        "update",
        "Clover checked member ids, job statuses, and the log action names against the spec."
      ),
      entry(
        "log_ic05",
        isoDaysAgo(1, 15, 10),
        "luffy",
        "comment",
        "Luffy told Iceburg to keep the page read-only and leave writing to Grok."
      ),
      entry(
        "log_ic06",
        isoDaysAgo(1, 18, 5),
        "iceburg",
        "done",
        "status -> complete. Iceburg finished the pages deploy path and marked the app ready.",
        [link("Crew Log", "https://example.com/crew-log")]
      ),
    ],
  }),
  makeJob({
    id: jobId(isoDaysAgo(12, 10, 0), "bots"),
    title: "EXAMPLE · New research bot",
    assignees: ["vegapunk", "uta", "clover"],
    lead: "vegapunk",
    division: "brand",
    status: "cancelled",
    priority: "low",
    tags: ["bots"],
    createdAt: isoDaysAgo(12, 10, 0),
    startedAt: isoDaysAgo(11, 9, 30),
    description: "Dong asked Vegapunk to design a research bot. He later told the crew to drop it.",
    links: [link("Bot sketch", "https://example.com/bots/draft")],
    log: [
      entry(
        "log_vp01",
        isoDaysAgo(11, 9, 30),
        "vegapunk",
        "started",
        "status -> in_progress. Vegapunk sketched a research bot and wrote its one job."
      ),
      entry(
        "log_vp02",
        isoDaysAgo(11, 16, 0),
        "vegapunk",
        "update",
        "Vegapunk drafted the bot's inputs, outputs, and where it would sit under Uta.",
        [link("Bot sketch", "https://example.com/bots/draft")]
      ),
      entry(
        "log_vp03",
        isoDaysAgo(10, 11, 15),
        "clover",
        "comment",
        "Clover flagged overlap with Robin's Life OS scope."
      ),
      entry(
        "log_vp04",
        isoDaysAgo(10, 15, 40),
        "uta",
        "update",
        "status -> cancelled. Uta recorded Dong's decision to drop the research bot."
      ),
    ],
  }),
];

function makeRun(id, at, result, text, linkedJobId = null) {
  return { id, at, result, text, jobId: linkedJobId };
}

function makeAuto(auto) {
  const runs = auto.runs;
  const last = runs[runs.length - 1];
  return {
    id: auto.id,
    memberId: auto.memberId,
    name: auto.name,
    trigger: auto.trigger,
    schedule: auto.schedule ?? null,
    cron: auto.cron ?? null,
    event: auto.event ?? null,
    action: auto.action,
    channel: auto.channel ?? null,
    status: auto.status,
    lastRunAt: last.at,
    lastResult: last.result,
    nextRunAt: auto.nextRunAt ?? null,
    runs,
    createdAt: auto.createdAt,
    updatedAt: last.at,
  };
}

export const DEMO_AUTOMATIONS = [
  makeAuto({
    id: "auto_haredas_example",
    memberId: "haredas",
    name: "EXAMPLE · Morning brief",
    trigger: "schedule",
    schedule: "Daily 07:00 PT",
    cron: "0 7 * * *",
    action: "Send Dong the morning brief: weather, calendar, and the top 3 jobs.",
    channel: "telegram",
    status: "active",
    nextRunAt: isoDaysAgo(-1, 7, 0),
    createdAt: isoDaysAgo(12, 8, 0),
    runs: [
      makeRun("run_hb01", isoDaysAgo(3, 7, 1), "ok", "Sent the brief with weather and the top 3 jobs."),
      makeRun("run_hb02", isoDaysAgo(2, 7, 4), "error", "Telegram rejected the brief before it reached Dong."),
      makeRun("run_hb03", isoDaysAgo(1, 7, 2), "ok", "Sent the brief with weather, the calendar, and the top 3 jobs."),
      makeRun(
        "run_hb04",
        isoDaysAgo(0, 7, 3),
        "ok",
        "Sent the brief with weather, two calendar items, and the Ship Crew Log job.",
        iceJobId
      ),
    ],
  }),
  makeAuto({
    id: "auto_ace_example",
    memberId: "ace",
    name: "EXAMPLE · Thesis check-in",
    trigger: "schedule",
    schedule: "Weekdays 10:00 PT",
    cron: "0 10 * * 1-5",
    action: "Check the thesis draft for new notes since yesterday and list anything still blocked.",
    status: "failing",
    createdAt: isoDaysAgo(18, 10, 0),
    runs: [
      makeRun("run_ax01", isoDaysAgo(4, 10, 1), "ok", "Filed the check-in: two new notes, nothing blocked."),
      makeRun("run_ax02", isoDaysAgo(3, 10, 2), "ok", "Filed the check-in: one new note on the literature section."),
      makeRun("run_ax03", isoDaysAgo(2, 10, 5), "error", "The thesis folder did not open, so the check-in did not send."),
      makeRun("run_ax04", isoDaysAgo(1, 10, 4), "error", "The thesis folder did not open again, so the check-in did not send."),
    ],
  }),
  makeAuto({
    id: "auto_perona_example",
    memberId: "perona",
    name: "EXAMPLE · Image request queue",
    trigger: "event",
    event: "New image request from Dong",
    action: "Add the new image request to the queue with the subject, size, and due date.",
    status: "paused",
    createdAt: isoDaysAgo(15, 11, 0),
    runs: [
      makeRun("run_pr01", isoDaysAgo(6, 14, 10), "ok", "Queued a 1024px portrait request for Nami."),
      makeRun("run_pr02", isoDaysAgo(5, 16, 40), "skipped", "Skipped a duplicate request for the same Nami portrait."),
      makeRun("run_pr03", isoDaysAgo(4, 9, 20), "error", "The queue file was locked, so the Franky portrait request did not save."),
      makeRun("run_pr04", isoDaysAgo(3, 15, 5), "ok", "Queued a 1024px portrait request for Zoro."),
    ],
  }),
  makeAuto({
    id: "auto_luffy_example",
    memberId: "luffy",
    name: "EXAMPLE · Crew standup report",
    trigger: "manual",
    action: "Send Dong the crew standup when he asks: who finished, who is blocked, and what needs a decision.",
    channel: "telegram",
    status: "draft",
    createdAt: isoDaysAgo(9, 21, 0),
    runs: [
      makeRun("run_lf01", isoDaysAgo(2, 21, 5), "ok", "Sent the standup: four jobs finished, one blocked, no decision needed."),
      makeRun("run_lf02", isoDaysAgo(1, 21, 8), "ok", "Sent the standup: two jobs finished, the thesis job still blocked."),
    ],
  }),
  makeAuto({
    id: "auto_iceburg_example",
    memberId: "iceburg",
    name: "EXAMPLE · Deploy and CI watch",
    trigger: "event",
    event: "GitHub CI failure on Dong's repos",
    action: "Report the GitHub CI failure with the repo, the workflow, and the first error line.",
    channel: "github",
    status: "active",
    nextRunAt: isoDaysAgo(-1, 11, 0),
    createdAt: isoDaysAgo(11, 11, 0),
    runs: [
      makeRun("run_ib01", isoDaysAgo(2, 16, 12), "error", "Saw a CI failure on progress-sync but the report did not send."),
      makeRun("run_ib02", isoDaysAgo(1, 18, 6), "ok", "Reported the Crew Log workflow failure and named the failing step."),
    ],
  }),
  makeAuto({
    id: "auto_usopp_example",
    memberId: "usopp",
    name: "EXAMPLE · Speaking drill prompt",
    trigger: "schedule",
    schedule: "Daily 12:30 PT",
    cron: "30 12 * * *",
    action: "Send today's speaking drill prompt with the time limit and the scoring focus.",
    status: "active",
    nextRunAt: isoDaysAgo(-1, 12, 30),
    createdAt: isoDaysAgo(8, 12, 30),
    runs: [
      makeRun("run_ud01", isoDaysAgo(3, 12, 31), "ok", "Sent a 3-minute drill prompt scored on structure."),
      makeRun("run_ud02", isoDaysAgo(2, 12, 33), "error", "The prompt did not send because the notes page timed out."),
      makeRun("run_ud03", isoDaysAgo(1, 12, 30), "ok", "Sent a 3-minute drill prompt scored on delivery."),
      makeRun("run_ud04", isoDaysAgo(0, 12, 32), "ok", "Sent a 3-minute drill prompt scored on the opening line."),
    ],
  }),
];
