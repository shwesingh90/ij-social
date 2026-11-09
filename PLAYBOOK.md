# Weekly post playbook

The Thursday scheduled task follows this file exactly. It publishes one Instagram carousel and one LinkedIn image post for InvestorJoint, fully automatically. Nobody approves the post, so the checks below are the approval: if any check fails, **do not post**.

## Accounts (Windsor.ai for Social Media)

| Platform | connector | account | action |
|---|---|---|---|
| Instagram @investorjoint | `instagram` | `17841469857926696` | `create_carousel_post` (`image_urls` 2–10 JPEGs in order, `caption` ≤ 2200 chars) |
| LinkedIn company page | `linkedin_organic` | `100540388` | `create_image_post` (`image_url`, `commentary` ≤ 3000 chars) |

Public image URL pattern (this repo is public):
`https://raw.githubusercontent.com/shwesingh90/ij-social/main/posts/<slug>/<file>.jpg`

## Steps

1. **Set up.** `git pull` on `main`. `cd tools && npm install` (installs playwright-core; Chromium is at `/opt/pw-browsers/chromium`, override with `CHROMIUM_PATH`).
2. **Pick the post.**
   - If any `posts/*/post.json` has `"status": "ready"` and `publish_on` ≤ today (Sydney time), use the oldest one. Its images and captions are already made: go to step 4.
   - Otherwise take the first `todo` row in `topics.md` and make a new post (step 3). Slug: `<YYYY-MM-DD of today>-<short-topic>`.
   - If a post for today's date already has `"status": "posted"`, stop: never post twice in a week.
3. **Make the post** in `posts/<slug>/`:
   - `ig-1.html` … `ig-N.html` (N = 4 to 6), each 1080×1350, and `li.html` at 1200×1200.
   - Copy the look of `posts/2026-11-12-inspections/` exactly: link `../../brand/brand.css`, root element `<div id="slide" style="width:…;height:…">`, Fraunces 800 headlines with an italic purple/sky accent line, Source Sans 3 body, palette from `brand.css` (light slides `#F4F1F8`, dark slides `#2B2730`, final slide `#7B3FA8`), InvestorJoint wordmark top-left ("Investor" + "Joint" in purple), slide counter top-right, inline stroke SVG icons only (no emoji in images).
   - Structure: slide 1 hook + one picture of the feature; middle slides one idea each (steps or benefits); last slide recap + "investorjoint.com.au" + "First property free". LinkedIn image: hook, picture, 3-point strip, footer.
   - Pictures: use real screenshots in `posts/<slug>/assets/` when Shwe has added them; otherwise draw a clean simplified mock of the screen in HTML showing only fields the feature really has, with obviously generic sample values (e.g. "Room 1 · $285 pw", "J. Nguyen"). No external image URLs, no web fonts other than `brand.css`.
   - Captions: `caption-instagram.txt` (hook line, 3 short numbered points, one benefit line, "Your first property is free → link in bio.", 6–8 hashtags) and `caption-linkedin.txt` (problem-first hook, short paragraphs, numbered steps, "Your first property is free: investorjoint.com.au", 4–5 hashtags). Australian English.
   - `post.json` in the same shape as the inspections one, `"status": "ready"`.
4. **Render.** From the repo root: `node tools/render.mjs posts/<slug>`. It must exit 0 (it fails on wrong sizes, broken images or missing fonts). Then open each JPEG with the image viewer and look at it: no clipped or overlapping text, nothing running off the edge.
5. **Check — every box must pass, or stop and go to "On failure".**
   - Only features that exist (the topic row's angle). No invented numbers, statistics, prices, customer names, testimonials, awards or claims about competitors. The only price claim allowed is "first property free".
   - No real street addresses, tenant names, emails, phone numbers or account IDs anywhere (images or captions). Blur them in screenshots.
   - Instagram: 2–10 JPEGs, each ≤ 8 MB, 4:5; caption ≤ 2200 chars. LinkedIn: one JPEG; caption ≤ 3000 chars.
   - Spelling checked; the website is written `investorjoint.com.au`.
6. **Publish the images.** Commit `posts/<slug>/` (HTML, assets, JPEGs, captions, post.json) to `main` and push. Then `curl -sI` every raw URL until each returns `200` with `content-type: image/jpeg` (retry for up to 5 minutes).
7. **Post.** Re-read `post.json`; skip any platform whose status is already `posted`.
   - Instagram: `execute_action` → `instagram` / `17841469857926696` / `create_carousel_post` with the raw URLs of `ig-1.jpg`…`ig-N.jpg` in order and the Instagram caption.
   - LinkedIn: `execute_action` → `linkedin_organic` / `100540388` / `create_image_post` with the raw URL of `li.jpg` and the LinkedIn caption.
   - Call each action once. If a call errors, do not retry it in a loop: one retry after 60 seconds at most, then record the failure.
8. **Record.** Set each platform's `status` to `posted` (with the returned id in `result`) or `failed` (with the error), and the post's `status` to `posted` if both posted, else `partial` or `failed`. Mark the topic row `done: <slug>`. Add a line to `log.md`. Commit and push.
9. **Report.** Finish with a short summary: topic, what posted where (with ids), anything that failed.

## On failure

Do not post anything that failed a check. Set the post's `status` to `failed` with a one-line reason in `notes`, commit and push, and end with a summary that says exactly what Shwe needs to fix. Never post a half-finished or placeholder image.

## Changing things

- Skip a week: add `"status": "skip"` to that week's post.json, or pause the scheduled task.
- Post something specific: put a folder in `posts/` with `post.json` `"status": "ready"` and a `publish_on` date.
- Change topics: edit `topics.md`.
