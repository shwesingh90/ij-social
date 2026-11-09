# Topic plan

The weekly run takes the first `todo` row, then marks it `done` with the post slug.
Only real, shipped InvestorJoint features. Rows marked `confirm` are not used until Shwe changes them to `todo`.
Shwe can reorder rows, add new ones, or drop a folder with `"status": "ready"` into `posts/` to jump the queue.

| # | Topic | Angle (what the post shows) | Status |
|---|-------|-----------------------------|--------|
| 1 | Property inspections | Incoming / ongoing / end-of-lease; create → walk through room by room → complete + report | queued: 2026-11-12-inspections |
| 2 | Rent collection dashboard | One glance: overdue + amount outstanding, due this week, received in 30 days, top priorities to chase | todo |
| 3 | Rooming houses | Each room its own rental: separate lease, separate rent, room details (type, furnishing, bathroom, features, availability) | todo |
| 4 | Leases in one place | Every lease against its property and tenant, start dates and status, linked to rent and inspections | todo |
| 5 | Work orders | Log a maintenance job against a property, track it to done | todo |
| 6 | Entities (trusts, companies, personal) | Hold properties under the right entity and see each entity's portfolio | todo |
| 7 | Built-in e-signing | Send leases and documents for signature from inside InvestorJoint | todo |
| 8 | First property free | Why try it: your first property is free; what you can set up on day one (property, entity, lease, rent, inspections) | todo |
| 9 | Developers / API access | investorjoint.com.au/developers: test account, build against your own data | todo |
| 10 | Zoho Sign as a signing option | Choose built-in e-sign or Zoho Sign when creating an envelope | confirm |
| 11 | Bank details encrypted | Field-level encryption of bank details (AWS KMS, Sydney region) | confirm |

When every row is `done`, start again from row 2 with a new angle (a different hook, a how-to, a "3 mistakes landlords make with X" framing) and note the angle in the log. Never repeat the same headline.
