# Reels playbook

The Mon/Wed/Fri scheduled task follows this file. Each run makes one short vertical video (about 21 s, 1080×1920, 30 fps, with original synthesised background music) and posts it to Instagram Reels, the Facebook Page (Reels), TikTok and YouTube Shorts. Posting is fully automatic, so the checks below are the approval: if a check fails, **do not post**.

## Accounts (Windsor.ai for Social Media)

| Platform | connector | account | action |
|---|---|---|---|
| Instagram @investorjoint | `instagram` | `17841469857926696` | `create_video_post` (`video_url`, `caption`, `cover_url` = cover.jpg, `share_to_feed: true`) |
| Facebook Page "Investor Joint" | `facebook_organic` | `496241900236188` | `create_reel` (`video_url`, `description` = caption with "link in bio" replaced by "investorjoint.com.au") |
| TikTok | `tiktok_organic` | from `get_connectors` | `create_video_post` (`video_url`, `caption`) |
| YouTube Shorts | `youtube` | from `get_connectors` | `upload_video` (`video_url`, `title` from youtube-title.txt, `description` = caption, `made_for_kids: false`, `privacy_status: "public"`, `category_id: "22"`) |

Run `get_connectors` first. A platform with no connected account is **not an error**: mark it `not_connected` in reel.json and carry on with the others.

Public URL pattern: `https://raw.githubusercontent.com/shwesingh90/ij-social/main/reels/<slug>/reel.mp4` (and `cover.jpg`).

## What each day makes

- **Monday and Friday: blog tip reel.** Take the newest URL in `daily/seen.json` → `blog` that is not in `reels/used.json` → `blog`. Fetch it (`curl -sL <url>`) and read the article in full. The reel gives 3 takeaways from that article only. Kicker = the article's topic in 1–3 words. Outro: `line1` "Read the full guide", `accent` "on our blog.", `cta` "Your first property is free".
- **Wednesday: feature reel.** Take the first `todo` row in `reels/features.md`. Only what that row's angle says the feature does. Outro: a short benefit line + accent, `cta` "Your first property is free".

One reel per day at most: if any `reels/*/reel.json` has `publish_on` = today (Sydney) and `"status": "posted"`, stop with a one-line summary. Never post the same reel or the same article twice (check `reels/log.md` and `reels/used.json`).

## Steps

1. **Set up.** `git pull` on `main`. `cd tools && npm install`.
2. **Write `reels/<YYYY-MM-DD>-<short-topic>/reel.json`** in the shape of `reels/2026-11-27-rent-collection/reel.json`: `hook` {kicker ≤ 22, line1 ≤ 34, accent ≤ 26, sub ≤ 80 chars}, exactly 3 `points` {title ≤ 40, body ≤ 90}, `outro` {line1 ≤ 30, accent ≤ 26, cta}, `source` (article URL or features row), `publish_on`, `status: "ready"`, `platforms` (instagram/facebook/tiktok/youtube, each `{status:"todo", result:""}`). The hook must make someone stop scrolling: a question or a sharp statement, never the feature name alone.
3. **Check frames first.** `node tools/reel.mjs reels/<slug> --frames 1.6,6,10,14,19` must exit 0 (it fails on text outside the safe area or missing fonts). Open each `frame-*.jpg` with the image viewer: no clipped, overlapping or orphaned text. Fix the copy and repeat. Delete the frame files.
4. **Render.** `node tools/reel.mjs reels/<slug>` → `reel.mp4` + `cover.jpg` (takes about a minute). Must exit 0.
5. **Captions.** `caption.txt`: hook line, the 3 points as short numbered lines, one benefit line, "Your first property is free → link in bio." (feature) or "Full article: link in bio." (blog), 5–7 hashtags. `youtube-title.txt`: one line ≤ 90 chars ending in `#shorts`. Australian English.
6. **Checks — every one must pass, or go to "On failure".**
   - Only facts from the article (blog) or the features row (feature). No invented numbers, stats, prices, testimonials or customer names; the only price claim is "first property free". For tax or law topics, stay general (what changed, who it affects), no personal advice.
   - No real addresses, tenant names, emails, phone numbers or account IDs.
   - Spelling checked; the site is written `investorjoint.com.au`.
7. **Publish the files.** Commit `reels/<slug>/` (reel.json, reel.mp4, cover.jpg, captions) and push. `curl -sI` the raw `reel.mp4` and `cover.jpg` URLs until both return `200` (retry for up to 5 minutes).
8. **Post** to each connected platform, one call each, about a minute apart. On an error, at most one retry after 60 seconds, then record the failure and move on. TikTok may refuse the URL (it only downloads from domains verified for Windsor's app) or keep the post private until TikTok approves Windsor's app: record what it returned, it is not a reason to stop the other platforms.
9. **Record.** In reel.json set each platform's `status` (`posted` / `failed` / `not_connected`) and `result` (id or error), and the reel's `status` (`posted` if at least one platform posted, else `failed`). Add the article URL to `reels/used.json` → `blog`, or mark the features row `done: <slug>`. Add one line to `reels/log.md`. Commit and push.
10. **Report.** 2–5 lines: the topic, what posted where (with ids), anything failed or not connected.

## On failure

Never post a reel that failed a check or a render. Set `"status": "failed"` with a one-line reason in `notes`, commit and push, and say exactly what Shwe needs to fix.

## Changing things

- Different feature order: edit `reels/features.md`.
- Post a specific reel: add a folder with a finished `reel.json` (`"status": "ready"`, `publish_on` today or earlier); the run renders and posts it instead of making a new one.
- Change the look: `tools/reel-template.html`. Change the music: `tools/music.py` (it is generated, so there are no licences to worry about).
