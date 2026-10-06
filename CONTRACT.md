# Crew Log writer contract

You are Grokbot, the only writer. Write the crew log into the private GitHub repo `Dong-Xuyong/progress-sync`, file `crew-log.json`, with the GitHub Contents API. Do not write job data into the website repo. The website reads this file itself.

The web app at https://dong-xuyong.github.io/crew-log/ is read-only and refreshes every 60 seconds. It also reloads on open and when the window gains focus. It never writes this file.

## File shape

```json
{
  "app": "crew-log",
  "version": 1,
  "updatedAt": "2026-10-06T21:55:00+01:00",
  "divisions": [
    { "id": "command", "name": "Command" },
    { "id": "ops", "name": "Ops" },
    { "id": "career", "name": "Career" },
    { "id": "health", "name": "Health" },
    { "id": "brand", "name": "Brand" }
  ],
  "members": [],
  "jobs": [],
  "automations": []
}
```

Keep `app` as `"crew-log"` and `version` as `1`. Keep these five divisions. Do not rename or remove a division id.

`updatedAt` is the time you last wrote the file. Use ISO-8601 with the Europe/Lisbon offset, for example `2026-10-06T21:55:00+01:00`. Do not use a `Z` suffix.

## Members

Each member object:

- `id`: stable slug. Never change an existing id.
- `name`: display name.
- `title`: role title.
- `division`: `command`, `ops`, `career`, `health`, or `brand`.
- `reportsTo`: a member id, or `null` for Luffy.
- `directReports`: member ids who report to this member. Keep this array consistent with `reportsTo`.
- `oneJob`: one sentence. Use `""` until you know it. You may fill it. Luffy's one job is already set: `Assign, unblock and report; escalate only big decisions to Dong.`
- `description`: longer bio. Use `""` until you know it. You may fill it.
- `avatar`: `assets/avatars/<id>.png`.
- `status`: `active` or `paused`. You may change it.
- `joinedAt`: `YYYY-MM-DD`.
- `updatedAt`: ISO-8601 with the Europe/Lisbon offset. Set it when you change the member.

You may add a new member. Use a new lowercase id that is not already in `members`. Set `reportsTo`, and add that id to the manager's `directReports`. If you change `reportsTo`, update both sides.

You may fill `oneJob`, `description`, and `status`. Never change an existing member id. Never delete a member.

Every id you write in `reportsTo`, `directReports`, `assignees`, `lead`, a log `memberId`, a subtask `memberId`, or an automation `memberId` must exist in `members`.

If GET returns 404, start from the crew seed: the five divisions and the 25 members (same ids, names, titles, divisions, and reporting lines). Leave `oneJob` and `description` empty except Luffy's one job. Start from the 25 draft automation starters (same ids, one per member, status `draft`). Then add the job.

## Jobs

Each job object:

- `id`: see Ids below.
- `title`: `YYYY-MM-DD short job`. The date is the Europe/Lisbon date when Dong gave the job. Example: `2026-10-06 Life OS ClickUp setup`.
- `requester`: `dong`.
- `assignees`: array of member ids. `lead` must be one of them.
- `lead`: member id. Must be in `assignees`.
- `division`: `command`, `ops`, `career`, `health`, or `brand`.
- `status`: `todo`, `in_progress`, `blocked`, `review`, `complete`, or `cancelled`.
- `priority`: `urgent`, `high`, `normal`, or `low`.
- `tags`: array of short strings.
- `createdAt`: ISO-8601. Set it when you create the job.
- `startedAt`: ISO-8601, or `null` until work starts.
- `completedAt`: ISO-8601, or `null` until status is `complete`.
- `due`: `YYYY-MM-DD`, or `null`.
- `description`: what Dong asked, in his words.
- `result`: final outcome summary. Use `""` until the job is finished.
- `links`: array of `{ "label": "...", "url": "https://..." }`. Allow only `http` and `https` URLs.
- `log`: array of entries. Append only.
- `subtasks`: array of `{ "id": "st_xxxx", "title": "...", "memberId": "<id>", "done": false }`.
- `parentJobId`: another job id, or `null`.
- `updatedAt`: ISO-8601. Set it whenever you change the job.

Each log entry:

- `id`: see Ids below.
- `at`: ISO-8601 with the Europe/Lisbon offset.
- `memberId`: the member who did the work.
- `action`: `started`, `update`, `handoff`, `blocked`, `done`, or `comment`.
- `text`: exactly what that member did. Concrete, past tense. Include paths and links when you have them.
- `links`: array of `{ "label", "url" }`, or `[]`.

## Automations

Put each automation in the top-level `automations` array, beside `jobs`.

Each automation object:

- `id`: `auto_<memberId>_<slug>`. Example: `auto_haredas_brief`. `<memberId>` is an existing member id. `<slug>` uses `a-z`, `0-9`, and `_`.
- `memberId`: a member id that exists in `members`.
- `name`: short display name.
- `trigger`: `schedule`, `event`, or `manual`.
- `schedule`: human text for a `schedule` trigger. End it with ` PT`. Times are Europe/Lisbon. Example: `Daily 07:00 PT`. Use `null` for `event` and `manual`.
- `cron`: five fields (minute, hour, day of month, month, day of week) in Europe/Lisbon, or `null`. Example: `0 7 * * *`. Use `null` for `event` and `manual`.
- `event`: human text for an `event` trigger. Example: `New image request from Dong`. Use `null` for `schedule` and `manual`.
- `action`: one sentence that says what the automation does.
- `channel`: a short name, or `null`. Examples: `telegram`, `whatsapp`, `instagram`, `email`, `github`, `calendar`, `app`.
- `status`: `draft`, `active`, `paused`, or `failing`.
- `lastRunAt`: ISO-8601 with the Europe/Lisbon offset of the newest run, or `null` when it has never run.
- `lastResult`: `ok`, `error`, or `skipped`, or `null` when it has never run.
- `nextRunAt`: ISO-8601 with the Europe/Lisbon offset of the next run, or `null`.
- `runs`: array of run objects. Append only. Oldest first, newest last.
- `createdAt`: ISO-8601 with the Europe/Lisbon offset. Set it when you create the automation.
- `updatedAt`: ISO-8601 with the Europe/Lisbon offset. Set it whenever you change the automation.

Each run object:

- `id`: `run_xxxx`, where `xxxx` is a fresh random 4 characters from `a-z` and `0-9`. Example: `run_a1b2`.
- `at`: ISO-8601 with the Europe/Lisbon offset.
- `result`: `ok`, `error`, or `skipped`.
- `text`: what that run did. Concrete.
- `jobId`: a job id that exists in `jobs`, or `null`.

Keep only the last 50 runs. When a new run would make 51, drop the oldest until 50 remain.

Seed starters use `status` `draft`, an empty `runs` array, and null `lastRunAt`, `lastResult`, and `nextRunAt`.

Set `status` to `active` once the real automation exists.

After every run, append one run with a fresh `run_xxxx` id. Set `lastRunAt` to that run's `at`. Set `lastResult` to that run's `result`. Set `nextRunAt` to the next Europe/Lisbon time. Set `updatedAt` to the current time.

If the newest two runs are both `error`, set `status` to `failing`. After an `ok` run, if `status` is `failing`, set `status` to `active`.

Never delete an automation. Set `status` to `paused` to stop it.

On 409, merge automations by id. Newest `updatedAt` wins on the automation. Union `runs` by id. If the same run id exists on both sides, keep the run with the newer `at`. Never drop a run id from either side. After the merge, keep the last 50 runs, oldest first.

Worked example. One automation, two runs. This object is one item of `automations`.

```json
{
  "id": "auto_haredas_brief",
  "memberId": "haredas",
  "name": "Morning brief",
  "trigger": "schedule",
  "schedule": "Daily 07:00 PT",
  "cron": "0 7 * * *",
  "event": null,
  "action": "Send Dong the morning brief: weather, calendar, top 3 jobs.",
  "channel": "telegram",
  "status": "active",
  "lastRunAt": "2026-10-06T07:00:12+01:00",
  "lastResult": "ok",
  "nextRunAt": "2026-10-07T07:00:00+01:00",
  "runs": [
    {
      "id": "run_a1b2",
      "at": "2026-10-05T07:00:08+01:00",
      "result": "ok",
      "text": "Sent the brief with weather, three calendar items, and the top 3 jobs.",
      "jobId": null
    },
    {
      "id": "run_c3d4",
      "at": "2026-10-06T07:00:12+01:00",
      "result": "ok",
      "text": "Sent the brief with weather, two calendar items, and the top 3 jobs.",
      "jobId": "job_20261006_ab12"
    }
  ],
  "createdAt": "2026-10-04T18:10:00+01:00",
  "updatedAt": "2026-10-06T07:00:12+01:00"
}
```

## Ids

- Job: `job_YYYYMMDD_xxxx`. `YYYYMMDD` is the Europe/Lisbon date Dong gave the job. `xxxx` is exactly 4 characters from `a-z` and `0-9`. Example: `job_20261006_ab12`.
- Log: `log_xxxx`, where `xxxx` is a fresh random 4 characters from `a-z` and `0-9`. Example: `log_a1b2`.
- Subtask: `st_xxxx`, where `xxxx` is a fresh random 4 characters from `a-z` and `0-9`. Example: `st_c3d4`.
- Automation: `auto_<memberId>_<slug>`. `<slug>` uses `a-z`, `0-9`, and `_`. Example: `auto_haredas_brief`.
- Run: `run_xxxx`, where `xxxx` is a fresh random 4 characters from `a-z` and `0-9`. Example: `run_a1b2`.
- Every id is unique in the file.

## Lifecycle

- New job: set `status` to `todo`, set `createdAt` to now, leave `startedAt` and `completedAt` null.
- When work starts: set `startedAt` and append a `started` log entry.
- Every meaningful step a member does: append one `update` log entry that says exactly what that member did.
- Passing work: append a `handoff` entry that names the next member.
- Blocked: set `status` to `blocked` and append a `blocked` entry with the reason.
- Finishing: set `status` to `complete`, set `completedAt`, write `result` as a short summary, and append a `done` entry.
- Any status change also appends a log entry whose text is `status -> <status>` plus context.
- Never delete a job. Never delete a log entry. Cancel with status `cancelled`.

## Write rules

- GET the file first. Modify that copy. PUT the full JSON back with the `sha` from that GET.
- Set the top-level `updatedAt`, and `updatedAt` on each job, member, or automation you touch, to the current time as ISO-8601 with the Europe/Lisbon offset. Example: `2026-10-06T21:55:00+01:00`.
- On 409, GET again. Re-apply your change by id. PUT once more. If that PUT also returns 409, stop and report the error. Do not retry again.
- On that retry, newest `updatedAt` wins per job, per member, and per automation. Log entries are append-only and merge as a union by id. Log entries have no `updatedAt`; if the same log id exists on both sides, keep the entry with the newer `at`. Never drop a log id from either side. Runs merge as a union by id. If the same run id exists on both sides, keep the run with the newer `at`. Never drop a run id from either side.
- Preserve every job, member, division, log entry, and automation you did not mean to change.

## API

Repo: `Dong-Xuyong/progress-sync`. Path: `crew-log.json`.

GET `https://api.github.com/repos/Dong-Xuyong/progress-sync/contents/crew-log.json`

PUT `https://api.github.com/repos/Dong-Xuyong/progress-sync/contents/crew-log.json`

Headers on both:

- `Authorization: Bearer <token>`
- `Accept: application/vnd.github+json`
- `User-Agent: crew-log`

On PUT, also send `Content-Type: application/json`.

PUT body:

- `message`: `Update crew-log`
- `content`: base64 of the UTF-8 bytes of the full JSON file
- `sha`: the `sha` field from the GET response

Read `content` and `sha` from the GET response. Decode `content` from base64 to UTF-8, then parse JSON.

A 404 on GET means nothing is saved yet. Build the full file and PUT without `sha`.

## Token

Use a fine-grained personal access token. Limit repository access to `Dong-Xuyong/progress-sync` only. Permission: Contents, Read and write. Never put the token in any repo, in a URL, or in a commit.

## Worked example

One job, three log entries, three members. This object is one item of `jobs`.

```json
{
  "id": "job_20261006_ab12",
  "title": "2026-10-06 Life OS ClickUp setup",
  "requester": "dong",
  "assignees": ["robin", "nami", "luffy"],
  "lead": "robin",
  "division": "ops",
  "status": "in_progress",
  "priority": "normal",
  "tags": ["clickup", "life-os"],
  "createdAt": "2026-10-06T09:00:00+01:00",
  "startedAt": "2026-10-06T09:05:00+01:00",
  "completedAt": null,
  "due": "2026-10-08",
  "description": "Set up the Life OS space in ClickUp the way Dong described it.",
  "result": "",
  "links": [{ "label": "ClickUp space", "url": "https://example.com/life-os" }],
  "log": [
    {
      "id": "log_r1a1",
      "at": "2026-10-06T09:05:00+01:00",
      "memberId": "robin",
      "action": "started",
      "text": "status -> in_progress. Robin opened the Life OS space and started the list map.",
      "links": []
    },
    {
      "id": "log_n2b2",
      "at": "2026-10-06T11:20:00+01:00",
      "memberId": "nami",
      "action": "update",
      "text": "Nami checked the ops lists against the daily note fields and marked three missing lists.",
      "links": [{ "label": "Field map", "url": "https://example.com/life-os/fields" }]
    },
    {
      "id": "log_l3c3",
      "at": "2026-10-06T15:40:00+01:00",
      "memberId": "luffy",
      "action": "handoff",
      "text": "Luffy handed the remaining list build back to Robin.",
      "links": []
    }
  ],
  "subtasks": [
    { "id": "st_c1d1", "title": "Create the Life OS space", "memberId": "robin", "done": true }
  ],
  "parentJobId": null,
  "updatedAt": "2026-10-06T15:40:00+01:00"
}
```
