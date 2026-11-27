"""List what InvestorJoint shipped in a date window, from the app repo's backlog (the status of record).
usage: python3 tools/shipped.py <path-to-ijapp> <since YYYY-MM-DD> [until YYYY-MM-DD]
Prints JSON: one entry per backlog item that has history rows in the window, with the item's
title/status/epic/why/detail and those rows. Also flags hints that a feature is NOT customer-visible
(ships dark, admin only, a kill switch off, docs/tests only). The reader still has to judge each one.
"""
import json, re, sys

repo, since = sys.argv[1], sys.argv[2]
until = sys.argv[3] if len(sys.argv) > 3 else '9999-12-31'
b = json.load(open(f'{repo}/docs/backlog/backlog.json'))
items = {i['id']: i for i in b.get('items', [])}

DARK = re.compile(r"ships dark|ship(s|ped)? off|kill switch[^.]{0,40}(0|off)|default off|behind app_settings\.[a-z_]+[^.]{0,30}(0|off)|super[- ]admin only|admin only|not deployed|awaiting|pending|not yet", re.I)
LIVE = re.compile(r"deployed|live on prod|on prod|enabled on prod|shipped", re.I)

out = {}
for h in b.get('history', []):
    d = h.get('d', '')
    if not (since <= d <= until):
        continue
    for iid in re.findall(r'U\d+', h.get('items', '') or ''):
        it = items.get(iid, {})
        e = out.setdefault(iid, {
            'id': iid, 'title': it.get('title', ''), 'status': it.get('status', ''), 'epic': it.get('epic', ''),
            'why': it.get('why', ''), 'detail': (it.get('detail', '') or '')[:1500], 'history': []})
        e['history'].append({'d': d, 'text': h.get('text', '')})

for e in out.values():
    blob = ' '.join([e['detail']] + [h['text'] for h in e['history']])
    e['looks_live'] = bool(LIVE.search(blob))
    e['not_live_hints'] = sorted({m.group(0) for m in DARK.finditer(blob)})[:6]

print(json.dumps(sorted(out.values(), key=lambda e: e['id']), indent=1))
