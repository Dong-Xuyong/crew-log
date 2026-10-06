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
  "jobs": []
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

Every id you write in `reportsTo`, `directReports`, `assignees`, `lead`, a log `memberId`, or a subtask `memberId` must exist in `members`.

If GET returns 404, start from the crew seed: the five divisions and the 25 members (same ids, names, titles, divisions, and reporting lines). Leave `oneJob` and `description` empty except Luffy's one job. Then add the job.

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

## Ids

- Job: `job_YYYYMMDD_xxxx`. `YYYYMMDD` is the Europe/Lisbon date Dong gave the job. `xxxx` is exactly 4 characters from `a-z` and `0-9`. Example: `job_20261006_ab12`.
- Log: `log_xxxx`, where `xxxx` is a fresh random 4 characters from `a-z` and `0-9`. Example: `log_a1b2`.
- Subtask: `st_xxxx`, where `xxxx` is a fresh random 4 characters from `a-z` and `0-9`. Example: `st_c3d4`.
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
- Set the top-level `updatedAt`, and `updatedAt` on each job or member you touch, to the current time as ISO-8601 with the Europe/Lisbon offset. Example: `2026-10-06T21:55:00+01:00`.
- On 409, GET again. Re-apply your change by id. PUT once more. If that PUT also returns 409, stop and report the error. Do not retry again.
- On that retry, newest `updatedAt` wins per job and per member. Log entries are append-only and merge as a union by id. Log entries have no `updatedAt`; if the same log id exists on both sides, keep the entry with the newer `at`. Never drop a log id from either side.
- Preserve every job, member, division, and log entry you did not mean to change.

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
