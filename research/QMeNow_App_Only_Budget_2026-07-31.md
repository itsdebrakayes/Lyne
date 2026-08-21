# Lyne App-Only Launch Budget

**Prepared:** 31 July 2026  
**Purpose:** A plain-language budget for taking the Lyne software from its present repository state to a responsible first commercial launch.  
**Planning exchange rate:** US$1 = J$160. The Bank of Jamaica’s June 2026 average selling rate was J$158.55 to US$1; J$160 is used here to make the arithmetic simple and leave a small foreign-exchange cushion.  
**Amounts:** Jamaican-dollar figures are rounded only where stated. Vendor prices can change, and card issuers may add foreign-transaction charges.

> **Budget decision:** The recommended app-only launch budget is **J$5,661,478 (US$35,384)**. If the founder completes the remaining product work herself and uses specialists only where outside verification is important, the practical cash floor is about **J$2,441,478 (US$15,259)**. The earlier J$11 million figure was a broad, fully outsourced commercial-launch allowance; it is not the amount Lyne must spend before a first private pilot.

## 1. What this budget covers

This budget covers the Lyne software itself:

- the mobile app used by members or customers;
- the staff and management application for Windows and the web;
- the online service that connects the apps and keeps the queue moving;
- the main operational database;
- the login and private-document service;
- the forecasting and branch-performance service;
- app-store release, Windows signing, testing, security and privacy readiness;
- one year of first-customer hosting; and
- a limited reserve for defects discovered immediately after launch.

It does **not** include:

- sales travel, prospect lunches, printed sales packs or observation visits;
- a salary or personal living expenses for the founder;
- public-procurement registration;
- customer-owned tablets, televisions, kiosks, printers or networking;
- a direct connection to a credit union’s banking system;
- a Jamaican card-payment processor;
- unlimited text messages;
- a full appointment and scheduled-session product for Traffic Court; or
- the cost of operating a large government contract before that contract is priced and signed.

Those exclusions are deliberate. They prevent the cost of winning customers and the cost of a future enterprise contract from being mistaken for the cost of finishing Lyne.

## 2. What already exists in the repository

Lyne is not being budgeted as a new app built from zero. The local repository contains approximately 43,754 lines of first-party JavaScript, TypeScript, Python and database code, excluding installed packages and generated files. More importantly, it contains working product areas:

| Product area already present | What it means in ordinary language |
|---|---|
| Consumer mobile app | A customer can find a branch or service, join a queue, see a live position and expected wait, receive updates, save agencies and manage a profile. |
| Staff and management app | Front-line staff can call and serve people. Supervisors, managers and executives have operational and performance views. A walk-in clerk can add someone who does not have the app. |
| Queue service | The system supports the basic journey from joining, through being called, to being served, with live updates. |
| Database | The structure for businesses, branches, services, queues, tickets, staff, targets, audit records and other operating information already exists. |
| Forecasting and analytics | Six analytical models run against queue information and write recommendations and forecasts back to the dashboards. |
| Security foundations | Login verification, role restrictions, branch/company separation, rate limits, validation and audit logging are already coded. |
| Website | The public marketing website already exists, and the domain has already been bought. |

The present repository is still a **local/demo deployment**. The outstanding work is therefore concentrated in four areas:

1. finish the production version and remove demo-only assumptions;
2. test it thoroughly on real devices and realistic branch workflows;
3. place it on secure, monitored internet hosting with backups; and
4. complete the release, privacy and independent assurance work a paying institution will reasonably request.

## 3. Recommended first-year budget

### 3.1 Summary

| Budget group | US dollars | Jamaican dollars | Share of total |
|---|---:|---:|---:|
| Finish and test the product | $15,625.00 | J$2,500,000 | 44.2% |
| Deployment, security and privacy work | $9,375.00 | J$1,500,000 | 26.5% |
| First-year vendor, store and registration fees | $2,175.15 | J$348,024 | 6.1% |
| Test equipment, release materials and early support reserve | $3,593.75 | J$575,000 | 10.2% |
| Contingency reserve, 15% | $4,615.34 | J$738,454 | 13.0% |
| **Recommended app-only total** | **$35,384.24** | **J$5,661,478** | **100%** |

“Contingency” means money held back for an unexpected but legitimate launch cost. It is not a target to spend. If it is not needed, it remains unspent.

### 3.2 Detailed line-by-line budget

| # | Line item | US dollars | Jamaican dollars | Why Lyne needs it |
|---:|---|---:|---:|---|
| 1 | Finish the production version | $6,875.00 | J$1,100,000 | Completes the remaining staff-screen usability work, first-run setup, onboarding guidance, empty states and the clean production version that contains no demo customers. This turns the existing application into something a real branch can start using. |
| 2 | Complete customer web entry and service-readiness flow | $3,125.00 | J$500,000 | The database groundwork exists, but a customer-facing web journey and the supporting live screens are not yet complete. This lets someone join without installing the mobile app and shows what documents or information to bring. It is particularly important for a credit-union pilot. |
| 3 | Mobile real-device and store-release pass | $1,875.00 | J$300,000 | Covers testing and correcting the app on actual iPhones and Android phones, notifications, permissions, weak internet, older devices and store packaging. Passing a code check is not the same as working well on real phones. |
| 4 | Full quality, accessibility and workflow testing | $3,750.00 | J$600,000 | Tests the complete journey: join, call, serve, no-show, close, reopen, report and recover from errors. It also checks that text, colour, keyboard use and screen-reader behaviour do not unnecessarily exclude users. |
| 5 | Production hosting setup and automatic release process | $2,812.50 | J$450,000 | Places Lyne safely on DigitalOcean, sets up private settings, automatic backups, health alerts and a repeatable release process. It also includes a recovery drill so a backup is proven usable rather than merely assumed to work. |
| 6 | Independent security review and correction allowance | $4,062.50 | J$650,000 | Pays someone other than the builder to try to find access-control, data-exposure and configuration weaknesses, then allows time to correct the important findings. Credit unions and public bodies will ask how security was independently checked. |
| 7 | Privacy and contract documents | $1,875.00 | J$300,000 | Covers a Jamaica-focused privacy policy, information-retention and deletion rules, a map of what personal information Lyne holds, customer contract/data-processing terms and review of consent wording. It is professional work, not simply a website template. |
| 8 | Windows installer and signing integration | $625.00 | J$100,000 | The repository can build a Windows installer, but production signing is not configured. This work connects the signing service or certificate to the release process and tests installation and updating on clean Windows machines. |
| 9 | DigitalOcean server, one year | $288.00 | J$46,080 | A “server” is the internet computer that runs Lyne’s queue service and analytics. The budget uses a 4 GB, two-processor DigitalOcean Droplet at $24 per month for a one-customer launch. |
| 10 | DigitalOcean daily server backups, one year | $86.40 | J$13,824 | DigitalOcean charges 30% of the server price for daily backups. This allows the server to be restored after a damaging update or failure. The managed database has its own included daily backup. |
| 11 | DigitalOcean managed MySQL database, one year | $180.00 | J$28,800 | MySQL is where queue, ticket, branch, staff and performance records live. “Managed” means DigitalOcean handles routine database maintenance and daily backups instead of the founder maintaining all of that alone. |
| 12 | DigitalOcean Spaces storage, one year | $60.00 | J$9,600 | A separate storage area for exports, backup copies and files that should not fill the main server. It also prevents large files from competing with the live queue service. |
| 13 | Supabase Pro, one year | $300.00 | J$48,000 | Supabase currently handles secure sign-in and private file storage. The paid plan avoids the inactivity limits of a free hobby project and includes larger allowances, support and daily backups. |
| 14 | Expo Application Services Starter, one year | $228.00 | J$36,480 | Expo’s service produces reliable iPhone and Android builds and sends controlled app updates. The $19 monthly Starter plan includes priority-build credit and up to 3,000 monthly updated installations before extra usage charges. |
| 15 | Apple Developer Program, one year | $99.00 | J$15,840 | Required to send the app through Apple’s TestFlight testing service, publish it in the App Store and use Apple push notifications. This is an annual membership. |
| 16 | Google Play developer account | $25.00 | J$4,000 | One-time registration to publish the Android app through Google Play. A new personal account also has identity, device and testing requirements before public release. |
| 17 | Windows code-signing allowance, one year | $840.00 | J$134,400 | A public digital signature helps Windows verify that the installer came from the named publisher and was not changed. The allowance uses DigiCert’s listed standard USB-token subscription. Eligibility and shipping to Jamaica must be confirmed before purchase. |
| 18 | Sole-trader completion allowance | $21.88 | J$3,500 | Uses the founder’s stated remaining amount. The official Companies Office fee page separately lists J$2,500 for sole-trader registration; a name search/reservation can be a different charge. Confirm the actual invoice before paying so the same step is not budgeted twice. |
| 19 | First data-controller registration | $46.88 | J$7,500 | The Office of the Information Commissioner charges a sole trader or individual J$7,500 for first registration as a data controller. Lyne handles personal information, so this is a real compliance cost, not an optional badge. Renewal is presently J$5,000 per year. |
| 20 | Domain and standard web encryption | $0.00 | J$0 | The domain has already been bought. Standard website encryption can be obtained at no charge through common automated certificate services. Future domain renewal is not included because the registrar and renewal date were not supplied. |
| 21 | Basic error and uptime monitoring | $0.00 | J$0 | DigitalOcean includes basic server monitoring, and a free error-monitoring plan is sufficient for the first controlled pilot. Upgrade only if usage, retention or institutional requirements justify it. |
| 22 | Low-volume system email | $0.00 | J$0 | Resend’s free plan currently includes up to 3,000 transactional emails per month, subject to a daily limit. Upgrade to its $20 monthly plan only when Lyne’s actual volume requires it. |
| 23 | Test devices and accessories allowance | $1,250.00 | J$200,000 | Provides access to at least one suitable iPhone and one Android test path, plus cables, stands or replacement batteries as required. If suitable devices are already available, this can be reduced. |
| 24 | Store listing and release materials | $468.75 | J$75,000 | Covers final screenshots, plain-language store descriptions, privacy links and release artwork for Apple, Google and the Windows download page. It does not include general sales material. |
| 25 | Early post-launch defect and support reserve | $1,875.00 | J$300,000 | Holds specialist time for issues found during the first live weeks. It should not be used for major new features requested by a customer; those belong in the customer contract. |
| 26 | Contingency reserve, 15% | $4,615.34 | J$738,454 | Covers price movement, bank conversion charges, a larger-than-expected defect, tax added to a contractor quote or a modest increase in professional effort. Release it only against a written reason. |
|  | **Total** | **$35,384.24** | **J$5,661,478** |  |

## 4. Monthly technology bill after launch

The large part of the launch budget is professional finishing and assurance work. The internet services themselves are comparatively modest.

### 4.1 First-customer monthly run rate

| Service | Monthly US dollars | Monthly Jamaican dollars | Plain-language purpose |
|---|---:|---:|---|
| DigitalOcean server | $24.00 | J$3,840 | Runs the live Lyne service and analytics. |
| Daily server backups | $7.20 | J$1,152 | Keeps seven daily server recovery points under the percentage-priced plan. |
| Managed database | $15.00 | J$2,400 | Holds the live operational records. |
| File/object storage | $5.00 | J$800 | Keeps exports and file copies separate from the server. |
| Supabase Pro | $25.00 | J$4,000 | Provides sign-in and protected file services. |
| Expo Starter | $19.00 | J$3,040 | Builds and updates the mobile app. |
| **Core monthly technology total** | **$95.20** | **J$15,232** | **US$1,142.40 / J$182,784 for twelve months.** |

Apple membership, Windows signing and the data-controller renewal are annual rather than monthly. Including those annual items, but not labour, the steady first-customer platform bill is approximately **J$338,000 per year** after the one-time Google fee and initial sole-trader fee.

### 4.2 Cost of adding another separately hosted institution

The repository’s stated approach is a separate deployment and main database for each contracted institution. A reasonable first allowance for each additional private institution is:

- another DigitalOcean server, daily backup, managed database and storage;
- a separate Supabase project or equivalent private sign-in environment; and
- usage charges only if real volume passes the included limits.

At today’s entry prices, that starts at approximately **US$734 per year, or J$117,500 per institution**, before support labour, text messages, unusual storage and any larger server required by measured traffic. The customer price must also pay for configuration, training, support, risk and profit; it should never be set equal to the hosting bill.

### 4.3 Large, high-availability contract

A large public body or national credit union should not run on the one-server pilot arrangement. “High availability” means there is a second live server, traffic can be moved if one fails, the database has failover protection, alerts are watched and recovery procedures are tested.

For planning only, allow:

| Large-contract operating layer | Annual US dollars | Annual Jamaican dollars |
|---|---:|---:|
| High-availability cloud services and paid platform plans | about $14,200 | about J$2,272,000 |
| Technical support and on-call operations | $12,500–$25,000 | J$2,000,000–J$4,000,000 |
| **Total annual operating allowance** | **$26,700–$39,200** | **J$4,272,000–J$6,272,000** |

This is not money to spend now. It is a cost to price into a large contract after the institution specifies expected users, branches, record retention, recovery time, operating hours, security reviews and support response times. A promise of “no downtime” is not realistic; the professional promise is a written availability target, redundancy, monitoring and a tested recovery plan.

## 5. The founder-led cash-floor option

The recommended budget assumes paid help for production finishing and testing. If the founder personally completes the product work, cash can be conserved, but independent review should not disappear.

| Cash-floor item | Jamaican dollars |
|---|---:|
| Selective external quality/accessibility testing | J$300,000 |
| Deployment and backup specialist | J$300,000 |
| Independent security review and limited fixes | J$400,000 |
| Privacy and contract documents | J$250,000 |
| Windows signing integration | J$75,000 |
| All first-year vendor, store and registration fees | J$348,024 |
| Test devices/accessories | J$200,000 |
| Release materials | J$50,000 |
| Early support reserve | J$200,000 |
| Subtotal | J$2,123,024 |
| Contingency, 15% | J$318,454 |
| **Founder-led cash floor** | **J$2,441,478 / US$15,259** |

This option does not mean the founder’s work has no value. It means her labour is being invested rather than paid out in cash. For grant applications and company accounts, contributed founder labour should still be recorded as an in-kind contribution.

## 6. Why the earlier figure was J$11 million

The earlier number combined the application, a conservative outsourced build allowance, business readiness, customer acquisition, training, a large infrastructure reserve and contingency. That was useful as a “do everything professionally for a year” ceiling, but it was too broad for the user’s new request for an app-only budget.

| Earlier J$11M category | Earlier allowance | Revised app-only allowance | What changed |
|---|---:|---:|---|
| Product completion and testing | J$4,000,000 | J$2,500,000 | More repository work is already complete than a greenfield estimate assumes; specialist work is targeted to remaining gaps. |
| Deployment and security | J$2,000,000 | J$1,200,000 | Sized for a first private deployment, not government-scale operations before a contract. |
| Legal and privacy | J$1,000,000 | J$311,000 | Uses a practical sole-trader document package plus the official first data-controller fee. |
| Stores, Windows signing and release materials | J$350,000 | J$229,240 | Uses verified current public fees and a modest artwork allowance. |
| Equipment and customer training | J$650,000 | J$200,000 | Only test equipment remains. Customer hardware and training are quoted to the customer. |
| Pilot, sales and support | J$800,000 | J$300,000 | Sales travel is removed; only an early defect/support reserve remains. |
| Infrastructure | J$1,200,000 | J$182,784 | Replaced a broad commercial reserve with the repository’s actual DigitalOcean, MySQL, Supabase and Expo first-customer plan. |
| Contingency | J$1,000,000 | J$738,454 | Recalculated at 15% of the revised plan. |
| **Total** | **J$11,000,000** | **J$5,661,478** | **J$5,338,522 lower.** |

## 7. The J$250,000 sales/travel/demo question

The previous J$250,000 was intended as an **entire-year allowance**, not the cost of one demo. It assumed approximately eight to ten prospect meetings or demonstrations, several in-person observation periods, local transport, mobile data, printing and some out-of-town or last-minute cost.

That allowance is too high for the app-only budget and is now **J$0 in this document**.

For the feasibility plan, a leaner separate customer-acquisition allowance of **J$100,000 for the year** is more appropriate:

| Separate sales activity | Annual allowance |
|---|---:|
| Transport for six to eight Kingston/St Andrew meetings | J$40,000 |
| Two structured branch observations | J$20,000 |
| Printing, data and small presentation expenses | J$15,000 |
| Unplanned follow-up or one farther trip | J$25,000 |
| **Separate annual sales allowance** | **J$100,000** |

If a prospect requires repeated out-of-town visits, a paid on-site study or a custom demonstration, that should be quoted to the prospect or approved as a separate campaign—not silently taken from the app budget.

## 8. Sole trader, D-U-N-S and store-name implications

### 8.1 Sole trader

A sole trader is an individual operating a business. It is not the same legal structure as an incorporated company. This matters for contracts, liability and the name shown in app stores.

The budget keeps the founder’s stated **J$3,500** allowance. The Companies Office currently lists **J$2,500** for registration or renewal of a sole trader, while a name search/reservation can be a separate fee. The correct next action is to check the Companies Office invoice and pay only the outstanding item.

### 8.2 D-U-N-S

**D-U-N-S** means **Data Universal Numbering System**. It is a unique nine-digit business identifier issued by Dun & Bradstreet. Apple and Google use it to help verify an organization. Requesting the number itself is normally free.

For the present sole-trader route:

- Apple permits an individual or sole proprietor to enrol as an individual. A D-U-N-S number is not required for that individual route, but the founder’s personal legal name is shown as the App Store seller.
- Apple organization enrolment requires a legal entity and a D-U-N-S number. Apple does not accept a trading name by itself as the organization.
- Google permits personal and organization developer accounts. Organization verification uses a D-U-N-S number. A new personal account has extra testing and device-verification requirements.

Therefore, D-U-N-S is **not a paid launch line item** in this budget. The real decision is branding: publish now under the founder’s legal name, or wait until Lyne has a legal entity that can be displayed as the seller.

## 9. Plain-language abbreviation guide

| Abbreviation or term | Meaning |
|---|---|
| API | Application Programming Interface: a controlled way for one part of the system, or an approved outside system, to exchange information with another. |
| APNs | Apple Push Notification service: Apple’s route for sending an iPhone alert when the app is not open. |
| CI/CD | Continuous Integration and Continuous Delivery: automated checks and release steps that reduce manual mistakes when a new version is published. |
| D-U-N-S | Data Universal Numbering System: a free nine-digit identifier used to verify a business organization. |
| EAS | Expo Application Services: the service Lyne uses to build and update the iPhone and Android apps. |
| FCM | Firebase Cloud Messaging: Google’s service for sending mobile push notifications, especially to Android devices. |
| GB or GiB | Gigabyte or gibibyte: a measure of computer memory or storage. For this budget, both simply indicate the size of the server or file allowance. |
| GCT | General Consumption Tax: Jamaican tax that may be added to a local supplier’s quote. |
| iOS | The operating system used by Apple iPhones. |
| JMD or J$ | Jamaican dollars. |
| MySQL | The main database software that stores Lyne’s operational records. |
| NSIS | The installer format presently configured for the Lyne Windows application. Users see it as the normal setup program. |
| OIC | Office of the Information Commissioner: Jamaica’s data-protection regulator. |
| OCR | Optical Character Recognition: reading typed text from a photograph or scan. |
| PII | Personally Identifiable Information: information that identifies or can be linked to a person. |
| PWA | Progressive Web App: a website that can be installed and used in an app-like way. Lyne’s staff interface can use this route as well as Windows. |
| QA | Quality Assurance: structured testing intended to find defects and confirm the product works as promised. |
| RAM | Random Access Memory: the short-term working memory available to a server or device. |
| SLA | Service-Level Agreement: a written commitment covering matters such as availability and response time. |
| SMS | Short Message Service: ordinary mobile text messages. |
| SSL/TLS | The standard encryption that protects information travelling between a user and a website or online service. |
| TRN | Taxpayer Registration Number. Lyne may hold it only where a service genuinely requires it and privacy rules permit it. |
| UI/UX | User Interface and User Experience: what people see and how easy, clear and safe the product is to use. |
| USD or US$ | United States dollars. |
| vCPU | Virtual Central Processing Unit: a share of computing power in an internet server. |
| VM | Virtual Machine: an internet-hosted computer. DigitalOcean calls its VMs “Droplets.” |

## 10. Spending controls and release sequence

Do not spend the entire recommended budget at once.

1. **Account and evidence stage — ceiling J$350,000.** Confirm sole-trader paperwork, register with the OIC, create the DigitalOcean/Expo/store accounts, and obtain written quotes for security, privacy and Windows signing.
2. **Pilot-ready stage — ceiling J$1.2 million additional.** Complete the specific customer web journey, production deployment and real-device testing required for the chosen one-branch pilot.
3. **Independent assurance stage — release only after a paid pilot, signed letter of intent or grant.** Commission the full security, privacy and accessibility work and close its important findings.
4. **Commercial-release stage.** Pay the annual store/signing fees, final release work and early support reserve when the launch date and customer are real.

This staged approach preserves cash and keeps the product aligned with the first customer’s actual workflow.

## 11. Source register

### Local repository

- `README.md` — current product, architecture, security, hosting plan and deployment state.
- `docs/REMAINING_WORK.md` — remaining product, testing, hosting and compliance work.
- `docker-compose.yml` — the current MySQL, backend and analytics services.
- `apps/mobile/app.json` — mobile identifiers and the currently blank Expo project identifier.
- `apps/admin-desktop/package.json` — Windows installer configuration and the absence of production signing configuration.
- Database migrations 023, 025 and 027 — groundwork for public web joining, service readiness and scheduled sessions.

### Current public prices and official rules

- Bank of Jamaica average exchange rates: https://boj.org.jm/market/foreign-exchange/average-exchange-rates/
- DigitalOcean Droplet prices: https://www.digitalocean.com/pricing/droplets
- DigitalOcean backup prices: https://www.digitalocean.com/pricing/backups
- DigitalOcean managed database and platform prices: https://www.digitalocean.com/pricing
- DigitalOcean Spaces price: https://docs.digitalocean.com/products/spaces/details/pricing/
- Supabase prices: https://supabase.com/pricing
- Expo plans: https://docs.expo.dev/billing/plans/
- Apple Developer Program: https://developer.apple.com/programs/whats-included/
- Apple individual/organization comparison: https://developer.apple.com/support/compare-memberships/
- Apple enrolment and D-U-N-S requirements: https://developer.apple.com/programs/enroll/
- Google Play registration: https://support.google.com/googleplay/android-developer/answer/6112435
- DigiCert Windows code-signing prices: https://www.digicert.com/signing/compare-code-signing-certificates
- Resend email prices: https://resend.com/docs/knowledge-base/what-is-resend-pricing
- Companies Office fees: https://www.orcjamaica.com/Fees.aspx
- Office of the Information Commissioner fees: https://oic.gov.jm/page/how-pay-fees

## Final budget recommendation

Use **J$5.7 million (US$35.4 thousand)** as the responsible app-only funding request, with a written commitment that money will be released in stages. Use **J$2.44 million (US$15.26 thousand)** as the minimum external-cash plan if the founder personally completes the remaining development. Do not present J$11 million as the amount required before a first private pilot, and do not include J$250,000 of sales travel in the software budget.
