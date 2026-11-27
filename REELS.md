# Reels playbook

The Mon/Wed/Fri scheduled task follows this file. Each run makes one short vertical video (20–40 s, 1080×1920, 30 fps, with original synthesised background music) and posts it to Instagram Reels, the Facebook Page (Reels), TikTok and YouTube Shorts. Posting is fully automatic, so the checks below are the approval: if a check fails, **do not post**.

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

Together with the Tuesday feature announcement (`ANNOUNCEMENTS.md`), every week covers all three things Shwe wants: new features, new properties, and property-market news and blog content.

- **Monday: Australian property market update.** Search the web for this week's (last 7 days') Australian property news and pick the one most useful to investors and property managers: an RBA cash rate decision or statement, new ABS lending or housing data, a state law change (tenancy rules, stamp duty, land tax, minimum standards), APRA lending changes, or a monthly home value or rent index result. Use primary or reputable sources only (rba.gov.au, abs.gov.au, apra.gov.au, state government sites, the index publisher's own release, major news outlets) and open the source page itself (WebFetch), never a summary. Every number must appear on a source page you opened, exactly as written, with its date; put each source (`{title, url, date}`) in reel.json `sources` and name them in the caption ("Source: RBA, 2 Dec 2026"). Explain what happened and who it affects. No forecasts, no "you should", no advice; end the caption with "General information only, not financial advice." Kicker "Market update". If nothing notable happened, make a blog tip reel instead (Friday's recipe).
- **Wednesday: new rentals this week.** `python3 tools/week-listings.py reels/<slug> <today minus 7 days>` collects the listings the daily task posted this week (photos and facts come from their `item.json`), copies the photos in and writes `reel.json` with one photo scene per listing (up to 8). Check it, render it, and in the caption list each listing as "Suburb STATE · $X per week (per room for a room) · beds/baths/parking", then "Enquire on InvestorJoint: link in bio." (Facebook: the investorjoint.com.au/rent link) and 4–6 hashtags (`#ForRent`, `#RentalProperty`, the states). After posting, add the listing URLs to `reels/used.json` → `listings`. If it prints `(no new listings)`, make a feature reel instead: the first `todo` row in `reels/features.md`; only what that row's angle says the feature does.
- **Friday: blog tip reel.** Take the newest URL in `daily/seen.json` → `blog` that is not in `reels/used.json` → `blog`. Fetch it (`curl -sL <url>`) and read the article in full. The reel gives 3 takeaways from that article only. Kicker = the article's topic in 1–3 words. Outro: `line1` "Read the full guide", `accent` "on our blog.", `cta` "Your first property is free".

One reel per day at most: if any `reels/*/reel.json` has `publish_on` = today (Sydney) and `"status": "posted"`, stop with a one-line summary. Never post the same reel or the same article twice (check `reels/log.md` and `reels/used.json`).

## Steps

1. **Set up.** `git pull` on `main`. `cd tools && npm install`.
2. **Write `reels/<YYYY-MM-DD>-<short-topic>/reel.json`** in the shape of `reels/2026-11-27-rent-collection/reel.json` (text reels) or the file `tools/week-listings.py` writes (rentals): `hook` {kicker ≤ 22, line1 ≤ 34, accent ≤ 26, sub ≤ 80 chars}, 3–5 text `points` {title ≤ 40, body ≤ 90} or 1–8 photo points, `outro` {line1 ≤ 30, accent ≤ 26, cta}, `source` (article URL or features row), `publish_on`, `status: "ready"`, `platforms` (instagram/facebook/tiktok/youtube, each `{status:"todo", result:""}`). The hook must make someone stop scrolling: a question or a sharp statement, never the feature name alone.
3. **Check frames first.** `node tools/reel.mjs reels/<slug> --frames 1.6,6,10,14,19` must exit 0 (it fails on text outside the safe area or missing fonts). Open each `frame-*.jpg` with the image viewer: no clipped, overlapping or orphaned text. Fix the copy and repeat. Delete the frame files.
4. **Render.** `node tools/reel.mjs reels/<slug>` → `reel.mp4` + `cover.jpg` (takes about a minute). Must exit 0.
5. **Captions.** `caption.txt`: hook line, the 3 points as short numbered lines, one benefit line, "Your first property is free → link in bio." (feature) or "Full article: link in bio." (blog), 5–7 hashtags. `youtube-title.txt`: one line ≤ 90 chars ending in `#shorts`. Australian English.
6. **Checks — every one must pass, or go to "On failure".**
   - Only facts from the article (blog), the features row (feature), the listing pages (rentals) or the opened source pages (market update, every number with its source and date). No invented numbers, stats, prices, testimonials or customer names; the only price claim is "first property free". For tax or law topics, stay general (what changed, who it affects), no personal advice.
   - Never name or compare to other software products or brands (no "Trello-style", "like Xero", competitor names). Naming a news or data source as a citation is fine.
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
