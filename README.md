# Crew Log

A read-only work log for Dong's 25-member One Piece crew. Each job records who worked on it and what they did.

Live: https://dong-xuyong.github.io/crew-log/

Jobs and members live in Dong-Xuyong/progress-sync, file crew-log.json. The page reads that file on open, on window focus, and every 60 seconds. It never writes data.

Connect in Settings: paste a fine-grained GitHub token scoped to the repository Dong-Xuyong/progress-sync only, permission Contents: Read and write. Read-only Contents is enough for this viewer. Write is for Grok. Without a token the page shows demo mode (EXAMPLE jobs).

Avatars: upload 1024x1024 PNGs to assets/avatars/<id>.png, then run the deploy script. It writes 256px WebP thumbs at assets/avatars/thumb/<id>.webp.

Views: Board, List, Members, Org, Calendar, Dashboard, Usage. Profile opens from a member. A job opens in the drawer.

Usage reads `usage.json` from the progress-sync repo (raw GitHub, then the saved token if that file is missing). A missing file shows "No usage data yet" and does not change jobs that have no `usage` object. Optional job fields `model`, `agent_count`, and `effort` still show on the card when they are set. Schema: USAGE.md. Sample numbers load only with `?demo=1` (`test/usage.fixture.json`).

Keyboard: `/` focuses search. Esc closes the drawer and settings.

Deploy from the Second Brain repo root:

```bash
python scripts/sync_crew_log.py
```

CONTRACT.md is the writer spec for updating crew-log.json.
