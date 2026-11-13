# What the others sell, and what Lyne sells

**Date:** 12 November 2026. Internal: for pricing and sales conversations, not for the website.

Lyne's list prices (owner, 12 November 2026) are US$6,000 / 16,500 / 33,000 a
month, with a founding-partner discount that lands on US$4,500 / 12,500 /
25,000. That is roughly 5 to 15 times the published price of the cheap cloud
tools. A buyer's procurement team will find those prices, so the answer to
"why pay more?" has to be specific. This document is that answer, and also an
honest list of where the others are ahead.

## The market in one table

| | Qminder | Skiplino | Qmatic (Orchestra / cloud) | Wavetec | **Lyne** |
|---|---|---|---|---|---|
| Published price | US$869 or 1,149 a month, unlimited locations, 25 or 50 users | US$299 or 399 per location a month, 10 or 20 users | Quote only. UK government list: £30 per user a month, kiosk £22, display £8, services £1,000 a day | Quote only, sold with hardware | US$6,000 per location a month list; implementation from US$15,000 |
| Who it is built for | Retail, clinics, government counters in North America and Europe | Small and mid-sized businesses | Large enterprise, government, healthcare; on-premises or cloud | Banks and telecoms, hardware-led | Jamaican ministries, hospitals, banks and credit unions |
| Queue, ticket, kiosk | Yes (iPad kiosk) | Yes | Yes (own kiosks, printers) | Yes (own kiosks, printers, card dispensers) | Yes (iPad kiosk; ticket printing still to prove on a device) |
| Appointments | Paid add-on | Separate product, US$99–199 | Yes | Yes | Included |
| Lobby "Now Serving" screen | Apple TV app (you buy the TV and Apple TV) | TV app | Own display hardware | Own display hardware | Included, runs on any TV or signage you already have, no install |
| Customer phone app | Web waitlist | Yes | Mobile ticket | Virtual queue | Yes: join from home, live position, "leave now" timing |
| Text messages | Included in US/UK/Canada only | Extra fees | Yes | Yes | Built, switched off until sender registration; usage-priced |
| Reports | Staff, location and service reports | Reports by tier | Reports module; their old BI module loses support March 2026 | Real-time dashboards | Role dashboards (desk, supervisor, manager, executive), branch report as Word or PDF, executive-set targets |
| Forecasting | "Service Analyst" add-on | No | Via BI | Analytics | Wait-time model, best times to visit, busy-hour heatmaps, staffing pressure |
| Transfers between lines, court-style sessions | Service flow | No | Yes | Yes | Yes |
| Single sign-on | Premium plan (SAML) | Not mentioned | Enterprise | Enterprise | Not yet (planned) |
| Two-factor sign-in | Not listed | Not mentioned | Varies | Varies | Built, server-enforced, per organisation (on production after testing) |
| Open API / webhooks | Premium | Extra fee | Yes (Data Connect) | Yes | Not offered yet |
| Audit trail, data export | Data retention settings | Export on Enterprise | Yes | Yes | Activity log in the app; one-click export of everything the organisation owns |
| Hardware | Buy your own | Buy your own | Sold by Qmatic | Sold by Wavetec | Uses what you have; iPads and printers on request |
| Local presence in Jamaica | None | None | Through partners | Regional (a Curaçao bank is a customer) | Jamaican business, Jamaican support hours, same time zone |

## What a buyer gets from Lyne that the cheap tools do not include

1. **Implementation done for them.** The US$300–1,150 tools are self-serve: the
   buyer configures services, trains staff and wires up hardware alone. Lyne's
   implementation fee buys set-up of every branch, service and role, staff
   training on site, and a pilot run with Lyne in the room.
2. **The executive layer.** Most tools stop at "how long did people wait".
   Lyne gives the executive cross-branch comparison, targets they set, the
   cost of waiting in money, and a branch report a manager can hand to a
   board. That is what the Executive plan sells.
3. **Built for how Jamaica queues.** Walk-ins mixed with appointments,
   sessions like a court list, transfers between counters, people who arrive
   without a smartphone, sector language (patients, members, customers).
4. **Data protection for Jamaica.** Lyne is the data processor under the Data
   Protection Act 2020 with a contract, an export of everything, an audit log,
   no ID numbers stored, and encrypted off-site backups. A US self-serve tool
   gives a click-through agreement written for another country.
5. **Someone to call.** Local support in Jamaican hours, by people who have
   seen the branch.
6. **No hardware lock-in.** Qmatic and Wavetec make much of their money on
   kiosks and screens. Lyne's screens run on the TVs already on the wall.

## Where the others are ahead (fix or be ready to answer)

| Gap | Who has it | What to say or do |
|---|---|---|
| Track record and references | All four, for years | Founding-partner pricing is the trade: a discount for being a reference. |
| Single sign-on | Qminder Premium, Qmatic, Wavetec | Planned (`docs/security/SIGN_IN_HARDENING_PLAN.md` step 2). Two-factor is ready first. |
| Security certification (ISO 27001, SOC 2) | Qmatic, Wavetec | Not held. Offer the security overview and an independent penetration test. |
| Open API and webhooks | Qminder Premium, Qmatic | Not offered. Data export covers "can we get our data out". |
| Ticket printers and kiosks proven in the field | Qmatic, Wavetec | iPad kiosk works; printing needs one real device test before a contract. |
| On-premises install | Qmatic Orchestra | Cloud only. Some government buyers will ask. |
| Price on paper | Everyone | Never compare line by line with Qminder or Skiplino. Compare with doing it with nothing, or with a Qmatic or Wavetec quote that includes hardware and services. |

## How to use this in a negotiation

- Lead with outcomes and the executive layer, never with "we also have a
  ticket queue": that is where Lyne costs ten times more.
- When a buyer quotes Qminder's price, ask what it would cost them to set up,
  train and support it themselves, and who signs their data-processing
  agreement.
- The discount from list to US$4,500 is for being a founding partner (a two
  or three-year term, a named reference, a case study), not for asking.

Sources: [Qminder pricing](https://www.qminder.com/pricing/), [Skiplino pricing](https://skiplino.com/pricing),
[Qmatic UK G-Cloud 15 prices](https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-15/documents/720711/443153374376503-pricing-document-2026-01-29-1311.pdf),
[Qmatic Orchestra](https://www.qmatic.com/products/orchestra/), [Orchestra product updates (Cuspera)](https://www.cuspera.com/products/orchestra-7-x-6594/news),
[Wavetec and Maduro & Curiel's Bank](https://www.wavetec.com/?p=84857). Checked 12 November 2026.
