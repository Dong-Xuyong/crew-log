# Usage and cost

Crew Log can show model usage and cost. Every new field is optional. A job or log entry that omits them renders the same as before.

The website never writes these files. It only reads them.

## On a job or a log entry

Add an optional `usage` object to a job, a log entry, or both. Leave it off when you do not have numbers.

```json
"usage": {
  "model": "grok-4.7",
  "tokensIn": 820000,
  "tokensOut": 310000,
  "tokensCache": 70000,
  "usd": 0.84,
  "eur": 0.77,
  "source": "list-price",
  "eventIds": ["evt_grok_demo"]
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `model` | string | Model id, for example `grok-4.7`. |
| `tokensIn` | number | Prompt tokens. |
| `tokensOut` | number | Completion tokens. |
| `tokensCache` | number | Cache read or write tokens, if the source reports them. |
| `usd` | number or null | Cost in US dollars. `null` means there is no list price, so the chip says `no list price` instead of `$0.00`. Omit the field when the cost is simply unknown and should stay off the chip. |
| `eur` | number | Cost in euros. |
| `source` | string | `cursor-csv`, `list-price`, or `manual`. |
| `eventIds` | string array | Ids of matching rows in `usage.json` `events`. Use `[]` when there are none. |

Any of those fields may be omitted. The card chip is shown only when at least a model, a token count, or a money amount is present. The chip looks like `grok-4.7 · 1.2M tok · $0.84`. The tooltip lists input, output, cache, and euros.

These job fields are separate from `usage`, and they were already optional:

- `model` — display name of the model or models used.
- `agent_count` — integer count of agents. Omit it, or leave it off, when unknown. Zero is not shown.
- `effort` — short label such as `low`, `medium`, or `high`.

When any of those three is present, the job card and the job detail show them, for example `grok-4.7 · 2 agents · medium effort`.

## `usage.json`

Path in `Dong-Xuyong/progress-sync`: `usage.json`.

The page loads it from:

`https://raw.githubusercontent.com/Dong-Xuyong/progress-sync/main/usage.json`

That read uses the same refresh as the crew log: on open, when the window gains focus, and every 60 seconds. If the raw file is missing (HTTP 404) and a GitHub token is saved, the page tries the Contents API for `usage.json` in `Dong-Xuyong/progress-sync`, which is how `crew-log.json` is read. If that is also missing, the Usage tab says **No usage data yet**. The rest of the app still loads.

A network or HTTP error that is not a 404 shows **Usage data could not be loaded.** Cached jobs stay on screen.

```json
{
  "version": 1,
  "updatedAt": "2026-11-04T18:00:00+00:00",
  "plan": {
    "name": "Ultra",
    "pools": [
      { "id": "cursor", "label": "Cursor models", "limitUsd": 400, "usedUsd": 12.4 },
      { "id": "other", "label": "Other models", "limitUsd": 200, "usedUsd": 3.4 },
      { "id": "grokbot", "label": "Grok Bot weekly", "limitPct": 100, "usedPct": 18, "resetsAt": "2026-11-09T00:00:00+00:00" }
    ]
  },
  "events": [
    {
      "id": "evt_grok_demo",
      "at": "2026-11-02T10:15:00+00:00",
      "model": "grok-4.7",
      "tokensIn": 820000,
      "tokensOut": 310000,
      "tokensCache": 70000,
      "usd": 0.84,
      "eur": 0.77,
      "bot": "grokbot",
      "jobId": "job_20261006_ab12",
      "cloudAgentId": "ca_demo",
      "source": "list-price"
    }
  ],
  "daily": [
    {
      "date": "2026-11-02",
      "usd": 0.84,
      "eur": 0.77,
      "byModel": { "grok-4.7": { "usd": 0.84, "eur": 0.77 } },
      "byBot": { "grokbot": { "usd": 0.84, "eur": 0.77 } }
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `version` | `1`. |
| `updatedAt` | ISO-8601 time the file was written. |
| `plan.name` | Plan name, for example `Ultra`. |
| `plan.pools[]` | One bar per pool. Dollar pools use `limitUsd` and `usedUsd`. A pool with `usedPct` and no `limitUsd` is a percent bar, labeled `17% used`. A pool that also has `limitPct` is labeled `18% of 100%`. `resetsAt` is optional. |
| `events[]` | One model call or invoice row. `bot`, `jobId`, and `cloudAgentId` are optional. |
| `daily[]` | Per-day rollup. `byModel` and `byBot` values are either a number (USD) or `{ "usd", "eur" }`. |

When `events` is non-empty, the Usage tab totals from events and ignores `daily` for those totals, so a row is not counted twice. `daily` is the fallback when `events` is empty.

Dates are grouped in Europe/Lisbon, same as the rest of Crew Log.

### Buckets

- **By model** — sum of `events[].model`. A blank model is `unknown`.
- **By bot** — events with a `bot`. 
- **unattributed** — events with neither `bot` nor `jobId`.
- **Jobs (no bot)** — events with a `jobId` and no `bot`. They stay in the model and day totals. They are not called unattributed, because they point at a job.
- **By day / by month** — the Usage tab toggles between these. It also toggles USD and EUR. Plan pool bars stay in the unit stored on the pool (dollars or percent). An event with `usd: null` still counts toward events and tokens. Its cost is **no list price**, not $0. An event that has dollars but no euros still counts as €0 in the euro view.

## Large files

`usage.json` and `crew-log.json` are read with the GitHub token when the raw URL is missing. Files over 1 MB come back from the Contents API with an empty `content` field. The page then requests the same path with `Accept: application/vnd.github.raw`. If that fails, it tries `download_url`, then the git blobs API with the same raw media type. Smaller files still use the base64 `content` field.

## Sample fixture

`test/usage.fixture.json` is sample data for review. The app loads it only when the page URL contains `?demo=1`. It is not written into `crew-log.json`, and it is not used when that query is absent.

On `?demo=1` in demo mode (no GitHub token), the first example job also gets a `usage` object in memory so the cost chip can be seen. Reload without `?demo=1` and that chip is gone. Real jobs loaded with a token are never edited.
