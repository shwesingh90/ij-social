# ij-social

Weekly social posts for InvestorJoint (Instagram @investorjoint and the LinkedIn company page).

Every Thursday at about 9am Sydney time a scheduled Claude task follows [PLAYBOOK.md](PLAYBOOK.md): it picks the next topic from [topics.md](topics.md), designs an Instagram carousel and a LinkedIn image, renders them to JPEG, commits them here and posts them through Windsor.ai. Every run is recorded in [log.md](log.md).

This repo is public so Instagram and LinkedIn can fetch the images. Don't put anything private in it.

- `posts/<date>-<topic>/`: one folder per post (slide HTML, JPEGs, captions, post.json)
- `brand/`: fonts and colours
- `tools/render.mjs`: renders slide HTML to JPEG
