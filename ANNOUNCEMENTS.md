# Weekly new-feature announcements playbook

The Tuesday scheduled task follows this file. Each week it finds what InvestorJoint shipped to customers in the last 7 days, picks the headline feature, and announces it with a short video on Instagram (Reel), Facebook (Reel), TikTok and YouTube Shorts, and an image post on LinkedIn (which also lists the week's other notable features). Posting is fully automatic, so the checks below are the approval: if a check fails, **do not post**.

## Accounts (Windsor.ai for Social Media)

| Platform | connector | account | action |
|---|---|---|---|
| Instagram @investorjoint | `instagram` | `17841469857926696` | `create_video_post` (`video_url`, `caption`, `cover_url`, `share_to_feed: true`) |
| Facebook Page "Investor Joint" | `facebook_organic` | `496241900236188` | `create_reel` (`video_url`, `description` = caption with "link in bio" replaced by "investorjoint.com.au") |
| TikTok | `tiktok_organic` | from `get_connectors` | `create_video_post` (`video_url`, `caption`) |
| YouTube Shorts | `youtube` | from `get_connectors` | `upload_video` (`title` from youtube-title.txt, `description` = caption, `made_for_kids: false`, `privacy_status: "public"`) |
| LinkedIn company page | `linkedin_organic` | `100540388` | `create_image_post` (`image_url` = li.jpg, `commentary` = caption-linkedin.txt) |

Run `get_connectors` first; a platform with no connected account is marked `not_connected` and skipped, not an error.

Public URLs: `https://raw.githubusercontent.com/shwesingh90/ij-social/main/announcements/<slug>/<file>`.

## Steps

1. **Set up.** `git pull` on `main`; `cd tools && npm install`. If `announcements/*/reel.json` has `"status": "ready"` and `publish_on` ≤ today (Sydney), it is already made: skip to step 7. If one for this week already has `"status": "posted"`, stop.
2. **Find what shipped.** Clone the app repo read-only: `git clone --depth 1 https://github.com/shwesingh90/ijapp /tmp/ijapp` (if that fails for lack of access, stop and report that adding shwesingh90/ijapp to the session's GitHub sources fixes it). Run `python3 tools/shipped.py /tmp/ijapp <today minus 7 days> <today>`. It lists every backlog item with activity this week (the backlog is the app's status of record) with its history notes.
3. **Decide what is announceable.** An item counts only if ALL of these hold:
   - Its **newest** history note (or the item's detail) says it is **deployed to prod**. Older "not deployed" notes in the same week don't matter if a later one says deployed. The `not_live_hints` field is a prompt to look, not a verdict.
   - It is **switched on for customers**: not "ships dark", not behind an `app_settings` switch that is 0/off, not super-admin-only, not a staff/admin tool. When in doubt, read the owning context's `CLAUDE.md` in `/tmp/ijapp/backend/contexts/<Context>/` and the module table in `/tmp/ijapp/CLAUDE.md`. Still unsure → leave it out.
   - A customer would **notice and care**: a new feature or a clearly better workflow. Not bug fixes, security/infra work, tests, docs, migrations, refactors, or internal tooling.
   - It is not already in `announcements/announced.json`.
   If nothing qualifies, finish with a one-line "no customer-facing features shipped this week" summary and commit nothing.
4. **Pick the headline** (the most useful to the most customers) and up to 3 runners-up. Related items (e.g. several phases of one feature) are one feature. Write down in your own words, from the code docs only, what each does for a property manager, investor or advisor. No internal names (U-numbers, table names, flags, "migration"), no claims the docs don't support.
5. **Make the post** in `announcements/<YYYY-MM-DD>-<short-feature>/`, copying the shape of `announcements/2026-12-01-task-management/` exactly:
   - `reel.json` for the headline: kicker "New: <Feature>" (≤ 22 chars), a hook line that names the user's problem, 3 to 5 points covering the feature's main capabilities in concrete detail, outro, plus `source`, `features` (the backlog ids), `publish_on`, `status: "ready"`, `platforms` (instagram, facebook, tiktok, youtube, linkedin, each `{status:"todo", result:""}`). Check stills (`node tools/reel.mjs <dir> --frames 1.6,6,10,14,19`, look at every frame, delete them), then render (`node tools/reel.mjs <dir>`).
   - `li.html` (1200×1200, copy the task-management one's layout): "New this week" pill, the headline feature, one sentence, a 4-tile grid (the headline's key points, or the headline plus runners-up), footer. Render with `node tools/render.mjs <dir>` and look at `li.jpg`.
   - `caption.txt` (Instagram/Facebook/TikTok/YouTube), `caption-linkedin.txt` (problem-first, short paragraphs, numbered list, runners-up as "Also new this week: …" if any, "Your first property is free: investorjoint.com.au", 3–4 hashtags), `youtube-title.txt` (≤ 90 chars, ends with `#shorts`). Australian English.
6. **Checks — every one must pass, or go to "On failure".** Never name another company or product (no "Trello-style", "like Xero", competitor names): describe what the feature does instead. Only shipped, switched-on features; only what the code docs say they do; no invented numbers, prices, customer names or testimonials (the only price claim is "first property free"); no real addresses, names, emails, phone numbers or account IDs; spelling checked.
7. **Publish the files.** Commit the folder and push; `curl -sI` the raw `reel.mp4`, `cover.jpg` and `li.jpg` URLs until each returns `200` (retry up to 5 minutes).
8. **Post** to each connected platform once, about a minute apart; on an error at most one retry after 60 s, then record and move on. TikTok may refuse the URL or keep the post private until it approves Windsor's app: record it, don't stop.
9. **Record.** Platform statuses and results in `reel.json`, overall `status` (`posted` if any platform posted), the backlog ids appended to `announcements/announced.json`, a line in `announcements/log.md`. Commit and push.
10. **Report.** 2–5 lines: the feature, what posted where (with ids), runners-up mentioned, anything skipped as not-yet-live (so Shwe can tell you if it actually is live), anything failed.

## On failure

Never post something that failed a check. Set `"status": "failed"` with a one-line reason in `notes`, commit, push, and say what Shwe needs to do.

## Steering it

- Announce something specific, or hold one back: add a folder with a finished `reel.json` (`status: "ready"`), or add its backlog id to `announced.json` to skip it.
- Wrong call on whether something is live: tell Claude, and add a note here.
