"""Build the "new rentals this week" reel from listings the daily task posted.
usage: python3 tools/week-listings.py <reel dir> <since YYYY-MM-DD> [--max 8]
Collects daily/<date>/listing-*/ folders dated on/after <since> whose item.json has no `skip`,
that have photo.jpg, and whose URL has a posted line in daily/log.md and is not in reels/used.json
"listings". Copies each photo into the reel dir as listing-N.jpg and writes reel.json (hook, one photo
scene per listing, outro). Prints the listing URLs used, or "(no new listings)" and writes nothing.
Every fact comes from item.json, which the daily task read off the public listing page.
"""
import json, os, re, shutil, sys

out, since = sys.argv[1], sys.argv[2]
mx = int(sys.argv[sys.argv.index('--max') + 1]) if '--max' in sys.argv else 8
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
log = open(os.path.join(root, 'daily', 'log.md')).read()
used_p = os.path.join(root, 'reels', 'used.json')
used = json.load(open(used_p)) if os.path.exists(used_p) else {}
done = set(used.get('listings', []))

picks, seen_urls = [], set()
ddir = os.path.join(root, 'daily')
for day in sorted(os.listdir(ddir)):
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', day) or day < since:
        continue
    for name in sorted(os.listdir(os.path.join(ddir, day))):
        d = os.path.join(ddir, day, name)
        if not name.startswith('listing-') or not os.path.exists(os.path.join(d, 'photo.jpg')):
            continue
        it = json.load(open(os.path.join(d, 'item.json')))
        url = it.get('url', '')
        posted = re.search(re.escape(url) + r' \|[^\n]*(Instagram: \d|LinkedIn: urn|Facebook: \d)', log)
        if it.get('skip') or url in done or url in seen_urls or not posted:
            continue
        seen_urls.add(url)
        picks.append((d, it))
picks = picks[:mx]
if not picks:
    print('(no new listings)')
    sys.exit(0)

os.makedirs(out, exist_ok=True)
points = []
for n, (d, it) in enumerate(picks, 1):
    shutil.copy(os.path.join(d, 'photo.jpg'), os.path.join(out, f'listing-{n}.jpg'))
    room = bool(it.get('roomRental'))
    rent = it.get('rentPerWeek')
    p = {
        'photo': f'listing-{n}.jpg',
        'tag': ('Room for rent · ' if room else 'For rent · ') + (it.get('state') or ''),
        'title': (it.get('suburb') or '')[:22],
        'body': (f'${rent} per week' + (' per room' if room else '')) if rent else '',
        'url': it['url'],
    }
    if not room:
        p.update({'beds': it.get('beds'), 'baths': it.get('baths'), 'parking': it.get('parking')})
    points.append(p)

STATES = {'NSW': 'New South Wales', 'VIC': 'Victoria', 'QLD': 'Queensland', 'WA': 'Western Australia', 'SA': 'South Australia', 'TAS': 'Tasmania', 'ACT': 'the A C T', 'NT': 'the Northern Territory'}
def spoken(p, it):
    where = f"{it.get('suburb') or ''}, {STATES.get(it.get('state') or '', it.get('state') or '')}"
    rent = it.get('rentPerWeek')
    if it.get('roomRental'):
        return f"In {where}, a room for {rent} dollars a week." if rent else f"In {where}, a room for rent."
    bits = []
    if it.get('beds'): bits.append(f"{it['beds']} bedroom{'s' if it['beds'] != 1 else ''}")
    if it.get('baths'): bits.append(f"{it['baths']} bathroom{'s' if it['baths'] != 1 else ''}")
    head = f"In {where}: " + ', '.join(bits) if bits else f"In {where}"
    return head + (f", for {rent} dollars a week." if rent else ".")
lines = [spoken(p, it) for p, (_, it) in zip(points, picks)]
count = len(points)
reel = {
    'slug': os.path.basename(os.path.normpath(out)),
    'kind': 'listings',
    'source': 'daily/ listing posts: ' + ', '.join(p['url'] for p in points),
    'hook': {'kicker': 'New rentals', 'line1': 'Fresh rentals,', 'accent': 'just listed.',
             'sub': f"{count} new rental{'s' if count != 1 else ''} on InvestorJoint this week."},
    'points': points,
    'outro': {'line1': 'Like one?', 'accent': 'Enquire today.', 'cta': 'Browse rentals', 'url': 'investorjoint.com.au/rent'},
    'listings': [p['url'] for p in points],
    'narration': [f"Looking for a rental? Here {'are' if len(points) != 1 else 'is'} the newest {'homes' if len(points) != 1 else 'home'} on InvestorJoint this week."] + lines
                 + ["Like one? Enquire today at InvestorJoint dot com dot A U, slash rent."],
}
json.dump(reel, open(os.path.join(out, 'reel.json'), 'w'), indent=2)
print('\n'.join(reel['listings']))
