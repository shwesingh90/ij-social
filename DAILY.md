# Daily blog + rental listing playbook

The daily scheduled task follows this file. Each run posts every **new InvestorJoint blog article** and up to **two new rental listings** from investorjoint.com.au to Instagram (@investorjoint) and the LinkedIn company page. Posting is fully automatic, so the checks below are the approval: if a check fails for an item, do not post that item.

Accounts (Windsor.ai for Social Media): Instagram connector `instagram`, account `17841469857926696`. LinkedIn connector `linkedin_organic`, account `100540388`.

Public image URL pattern: `https://raw.githubusercontent.com/shwesingh90/ij-social/main/daily/<date>/<item>/card.jpg`

## Steps

1. **Set up.** `git pull` on `main`; `cd tools && npm install`.
2. **Discover.** From the repo root: `node tools/daily.mjs discover --max-listings 2 --max-blogs 3`. It compares the public sitemaps with `daily/seen.json` and creates one folder per new item under `daily/<today>/` with `item.json` (plus `article.txt` for a blog, `photo.jpg` for a listing). If it prints `(nothing new)`, finish with a one-line "nothing new today" summary and stop. Do not commit anything.
3. **Skipped items.** An `item.json` with a non-empty `skip` (for example a listing that restricts tenants by sex, religion or background, or one no longer available) is never posted. Run `node tools/daily.mjs seen <dir>`, add a `log.md` line with the reason, and list it in the final summary under "needs Shwe's attention", including the listing URL.
4. **Blog items: write the takeaways.** Read `article.txt` in full. Fill `takeaways` in `item.json` with exactly 3 points, each 4 to 9 words, plain Australian English, taken only from what the article says. No numbers unless the article states them exactly. No advice beyond the article. If it covers tax or law, keep it general ("what changed", "who it affects").
5. **Render.** `node tools/daily.mjs cards daily/<today>`. It must exit 0. Then open every `card.jpg` with the image viewer and check it: no clipped or overlapping text, the photo shows the property, and nothing is cut off at the edges. A listing whose photo is a flyer or graphic is fine. A photo that shows people's faces, a tenant's belongings close-up, or a document is not: skip that item (step 3).
6. **Write the captions** into the item folder:
   - **Blog → `caption-instagram.txt`**: the article's hook in one line, the 3 takeaways as short lines, "Full article: link in bio.", 4–6 hashtags. **`caption-linkedin.txt`**: a 2–4 sentence summary of the article in your own words (no copying whole sentences), why it matters to Australian property investors and managers, and 3–4 hashtags. The link goes in the LinkedIn post's link field, not the text.
   - **Listing → `caption-instagram.txt`**: "For rent in <Suburb> <STATE>" or "Room for rent in <Suburb> <STATE>" (when `roomRental` is true), then rent per week (per room if `roomRental`), beds/baths/parking (for a room: "a room in a N-bedroom home"), available date, furnished and pets status as listed, 1–2 lines describing the property using only facts in `description`, "Enquire on InvestorJoint: link in bio.", and 4–6 hashtags (suburb, state, `#ForRent`, `#RentalProperty`). **`caption-linkedin.txt`**: the same facts in 3–5 short lines, ending with "Enquire: <listing url>".
   - Rules for every caption: only facts that appear on the investorjoint.com.au page; never repeat tenant preferences or restrictions (who "should" apply: gender, students, couples, professionals and so on); no street number unless the listing title itself shows it; no owner or agent phone numbers or emails; Instagram ≤ 2200 characters, LinkedIn ≤ 3000.
7. **Publish the images.** Commit `daily/<today>/` and push. `curl -sI` each `card.jpg` raw URL until it returns `200` and `content-type: image/jpeg` (retry for up to 5 minutes).
8. **Post each item once.** Check `daily/log.md` first and never post a URL that already has a posted line.
   - Instagram, all items: `execute_action` → `instagram` / `17841469857926696` / `create_image_post` with the raw `card.jpg` URL and the Instagram caption.
   - LinkedIn, blog: `execute_action` → `linkedin_organic` / `100540388` / `create_post` with `commentary` = the LinkedIn caption, `link` = the article URL, `link_title` = the article title, `link_description` = the article's meta description from `item.json`.
   - LinkedIn, listing: `execute_action` → `linkedin_organic` / `100540388` / `create_image_post` with the raw `card.jpg` URL and the LinkedIn caption.
   - One call per action. On an error, at most one retry after 60 seconds, then record the failure and move on.
   - Leave about a minute between posts so the feed doesn't get a burst.
9. **Record.** For each item, run `node tools/daily.mjs seen <dir>` only if it posted to at least one platform (a failure on both platforms stays unseen so tomorrow's run retries it). Add a line per item to `daily/log.md`. Commit and push.
10. **Report.** A short summary: what posted where (with ids), anything skipped or failed and why, with links.

## Changing things

- Stop posting listings or blogs: tell Claude, or pause the scheduled task.
- Post fewer or more listings per day: change `--max-listings`.
- Never post a particular URL: add it to the right list in `daily/seen.json`.
