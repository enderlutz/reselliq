"""Curated playbook content. Auto-seeded; user edits live in user_notes_md.

Goal: help the user be a *normal-looking shopper* so legitimate orders don't
get cancelled. This is NOT about evasion — it's about understanding what
real-shopper signals each retailer's risk engine looks for, so a person
buying 2 Pokemon ETBs doesn't get bucketed with sneaker-bot scripts.
"""

CONTENT = [
    {
        "key": "payments",
        "title": "Payment methods & VCCs — what retailers can see",
        "summary": "Bank-issued virtual numbers are invisible to retailers. Prepaid VCCs aren't.",
        "sort_order": 5,
        "curated_md": """\
Bank-issued virtual numbers (Capital One Eno, Citi VAN) look identical to your real credit card to retailers. Prepaid VCCs (Privacy.com, Revolut Disposable) have their own BINs that flag them as "prepaid / fintech-issued debit" and trigger fraud-engine scrutiny. Use the right kind for the right job.

## Two flavors of VCC

### Bank-issued virtual numbers — invisible to retailers
- **Capital One Eno** — generates per-merchant virtual numbers tied to your real Capital One credit card
- **Citi Virtual Account Numbers (VAN)** — same idea
- **Apple Card** — one fixed virtual number revealed via Wallet

These use the **BIN of your real credit card**, so to the retailer's payment processor they look identical to your normal Capital One / Citi card. Same trust score, full credit-card benefits, full fraud protection. **Retailers cannot tell these apart from a regular charge.**

### Prepaid / fintech-issued VCCs — flaggable
- **Privacy.com** — debit-only, funded from your bank, the most popular reseller VCC
- **Revolut Disposable Cards**
- **Mercury / Lithic** — fintech-stack VCCs

These have **their own BINs** that retailers' fraud engines tag as "prepaid / fintech-issued debit." Even when you're 100% legitimate, you sit in a higher-risk pool. On hot drops, that pool gets denied first.

## How the BIN check works

The first 6 digits of any card (the BIN) identify the issuing program. Retailers' payment processors maintain BIN reputation scores from historical fraud data. Examples:

| BIN type | Reputation |
|---|---|
| Capital One credit (`4147xx`-style) | Trusted |
| Privacy.com Visa | "Prepaid" — extra scrutiny |
| Stolen-card-program BINs | Blocked outright |

This is a payment-side check that has **nothing to do with your account, address, or behavior**. The card itself either passes or fails the BIN reputation test.

## Per-retailer behavior (anecdotal, mid-2026)

| Retailer | Capital One Eno / Citi VAN | Privacy.com |
|---|---|---|
| **Target** | Treated as normal credit | Cancels frequently on hot drops |
| **Walmart** | Treated as normal credit | **Near-100% cancel rate** on hot drops |
| **Best Buy** | Treated as normal credit | Works on aged accounts; cancels on new |
| **GameStop** | Treated as normal credit | Generally accepted |
| **Sam's / Costco** | Treated as normal credit | Sam's allows; Costco picky |
| **Pokemon Center** | Treated as normal credit | **Aggressively flagged** |

## When VCCs are useful

- **Fraud isolation** — merchant gets breached, only that VCC is exposed
- **Per-merchant spend caps** — lock the card at exactly your order amount
- **Clean bookkeeping** — each VCC shows the merchant on your statement
- **Instant cancellation** — pause/close the moment something looks off

## Recommendations

- **Primary**: **Capital One Eno** or **Citi VAN**. All the security benefits, full credit-card rewards, look 100% normal to retailers. **No-brainer for hot drops.**
- **Secondary**: Privacy.com for low-stakes purchases (subscriptions, smaller retailers). Don't use as first-time payment on a new account at a major retailer. Don't use on Walmart hot drops.
- **Avoid**: stacking multiple Privacy.com cards across multiple "fresh" accounts at the same retailer. That IS the use case retailers built BIN blocklists to fight, and it violates "one account per person" TOS at every major chain.

The pattern that wins long-term: one real human, one normal credit-card profile, one shipping address, no tricks. The boring approach beats the stacked-VCC approach for sustained order success.
""",
    },
    {
        "key": "emails",
        "title": "Email & account identity",
        "summary": "Catchalls aren't banned. Disposable inboxes are. The flag is multi-account from same domain.",
        "sort_order": 6,
        "curated_md": """\
Retailers don't ban "catchalls" or Apple Hide My Email categorically. They ban patterns: disposable inbox services with public mailboxes, multiple accounts from the same domain at the same retailer, and email-name mismatches with your payment method.

## Email types and how they're treated

| Email type | Flag risk | Notes |
|---|---|---|
| **Real personal email** (you@gmail.com, you@your-name.com) | None | Default — what you want |
| **Apple Hide My Email** (xxxx@privaterelay.appleid.com) | None to low | Most retailers accept; some financial sites flag |
| **Custom-domain catchall** (anything@yourdomain.com) | Low | The flag is *multiple accounts* using it at one retailer |
| **Gmail "+suffix" alias** (name+target@gmail.com) | Normalized away | Retailers strip the +suffix; treated as base address |
| **Gmail dots variation** (n.a.m.e@gmail.com) | Normalized away | Same — treated as base address |
| **Disposable inbox** (mailinator, tempmail, guerrillamail) | Banned | Public mailboxes; instant flag |
| **Temp / one-time forwarding** (10minutemail, etc.) | Banned | Same |

## Apple Hide My Email — the closer look

Apple's iCloud+ feature generates random `xxxx@privaterelay.appleid.com` addresses that forward to your real iCloud email. Most consumer retailers respect it:

| Retailer | Hide My Email accepted |
|---|---|
| Target | ✅ |
| Walmart | ✅ |
| Best Buy | ✅ |
| GameStop | ✅ |
| Sam's Club | ✅ |
| Costco | ✅ |
| Pokemon Center | ✅ (occasional flagging reported) |
| Ticketmaster | ⚠️ Sometimes flagged |
| Banks / financial | ⚠️ Often rejected |

The rare flag at PC and at financial sites is when you use Hide My Email to create *multiple* accounts at the same service — Apple makes that very easy, retailers detect it.

**Best practice**:
- One Hide My Email alias per retailer is fine. Stable, persistent.
- Don't generate a fresh alias for each new account at the same retailer — that's the multi-account pattern they fight.
- One caveat: if you cancel iCloud+, all your Hide My Email aliases die simultaneously. Use this for retailers, not for critical financial accounts.

## Catchall domains — the smart-but-misunderstood option

A catchall is a domain you own where any local part routes to you (`target@yourdomain.com`, `walmart@yourdomain.com`). Reseller-popular because:
- Per-merchant tracking — instantly see which retailer leaked your address
- Phishing detection — a "Walmart" email arriving at `target@yourdomain.com` is fake
- Single inbox with merchant context

**Are catchalls flagged?** Not categorically. Custom domains look like professional/personal emails because that's what they are. The flag is identical to Hide My Email: using one catchall to create *multiple* accounts at one retailer (`target1@me.com`, `target2@me.com`) trips multi-account detection.

**Domains that DO get flagged:**
- Free disposable services (mailinator.com, tempmail.com, guerrillamail.com)
- Known reseller-community shared domains — retailers maintain lists
- Brand-new domains (registered <30 days, no historical reputation)

For a solo reseller, a personal-feeling custom domain (`yourname.com`, `yourbusiness.com`) registered for 6+ months is invisible to retailers. Use one address per retailer, persistent.

## Gmail aliases — don't bother

Gmail used to support `+suffix` aliases as a clever multi-account trick. Retailers caught up around 2018. They normalize:
- `john.smith+target@gmail.com` → `johnsmith@gmail.com`
- `j.o.h.n.s.m.i.t.h@gmail.com` → `johnsmith@gmail.com`

Two "different" Gmail aliases pointing at the same inbox = same account in retailer eyes. Aliases help you organize incoming mail; they don't help with multi-account.

## What to actually do

1. **Pick one email approach per retailer and stick with it.** Real Gmail, Apple Hide My Email alias, or custom-domain catchall — pick one and never change.
2. **Match the email's name to the payment method's name.** "John Smith" on the card and `j.smith@gmail.com` is fine. "John Smith" on the card and `mike.jones@gmail.com` is a soft flag.
3. **Verify the email at sign-up.** Click the verification link. Some retailers gate features behind verified email and silently degrade trust on unverified accounts.
4. **Phone-verify too.** Email + phone verification is a measurable trust bump.
5. **Don't churn emails.** If you get cancelled at Target with email A, don't immediately make a new account with email B — that's the multi-account flag. Wait 2–4 weeks, refine other variables instead.
""",
    },
    {
        "key": "addresses",
        "title": "Addresses & shipping identity",
        "summary": "Second only to payment-BIN signals. CMRAs and forwarders are the headline ban. Real residential wins.",
        "sort_order": 7,
        "curated_md": """\
Address signals are second only to payment-BIN signals in the cancellation engine. Get this right and most other things work; get it wrong and even a perfect account/email/payment combo can still cancel.

## Address types

| Address type | Trust score | Notes |
|---|---|---|
| **Real residential, owned 1+ year** | Highest | What every retailer wants to see |
| **Real residential, recently moved** | High | First few orders may flag; settles after 2–3 successful deliveries |
| **Apartment / condo** | Medium-high | Higher false-positive rate (multi-unit detection) but fully legitimate |
| **Family home (different last name)** | Medium | Soft flag on (name, address) tuple checks |
| **PO Box** | Mixed | USPS ships fine; UPS/FedEx may not. Many retailers refuse outright |
| **Military APO/FPO** | High | Treated favorably — retailers respect service members |
| **Hotel / temporary lodging** | Banned | Always flagged |
| **CMRA** (UPS Store mailbox, iPostal1, etc.) | Banned on hot drops | See below |
| **Freight forwarder** (Stackry, MyUS, Shipito) | Banned | Almost always blocked |

## CMRA — what it is and why it's banned

A **Commercial Mail Receiving Agency** is a third-party that receives mail on your behalf. UPS Store mailboxes, iPostal1, AnyTime Mailbox, Earth Class Mail, Streetwise Maildrop — all CMRAs.

CMRAs must register with USPS (Form 1583) and **USPS publishes the registry**. Any retailer can subscribe. Every CMRA address you can buy is on the list.

Why retailers ban CMRAs for hot drops:
- They're the dominant address type used by multi-account scalpers
- One CMRA can technically host hundreds of "mailboxes" at one physical address
- They route to wherever the customer wants — including international forwarding
- They're correlated with reseller / arbitrage patterns in retailer fraud data

For everyday non-hot-drop purchases, some retailers accept CMRAs. For Pokemon hot drops, they cancel.

## Forwarding services

Stackry, MyUS, Shipito, Borderlinx, Reship — these are international forwarders. Order ships to a US warehouse, they re-ship internationally for a fee.

**Blocked at every major retailer.** Their addresses are in the same shared blocklists as CMRAs.

If you're shipping internationally, accept that hot drops aren't viable through forwarders. For normal in-stock items, some retailers (Walmart, Amazon) accept; most don't.

## Apartment / multi-unit gotchas

Apartments are legitimate but have higher false-positive rates because:
- Retailers look for multiple unrelated accounts at the same building
- The unit number disambiguates — **type it consistently** (`Apt 4B` vs `#4B` vs `Unit 4B` matters less than putting it in the right field)
- USPS ZIP+4 verification matches better with explicit unit numbers in the dedicated field

## Address verification at checkout

Almost every major retailer runs USPS ZIP+4 verification. Common gotchas:

- **Typo in street name** — flagged as bot-like (humans verify their own address)
- **Apartment number in wrong field** — should be in "Apt/Suite", not concatenated to street
- **State code uppercase** — `tx` vs `TX` rarely matters; both work
- **Zip+4 vs zip-5** — both work; retailer auto-completes the +4

If a retailer's address-validation widget says "did you mean X?" — accept their suggestion. Disagreeing flags as suspicious.

## Per-retailer address quirks

| Retailer | CMRA tolerance | Other flags |
|---|---|---|
| **Target** | None on hot drops | Address change <30 days; address-name mismatch |
| **Walmart** | None on hot drops | Same; also flags shipping zip ≠ billing zip |
| **Best Buy** | None on hot drops | Same |
| **GameStop** | Some flexibility | Mainly inventory issues, not address |
| **Sam's Club** | Member shipping address | Must match member of record |
| **Pokemon Center** | None | Address change <30 days = soft flag |

## What to actually do

1. **Use one residential address per retailer, persistent for 6+ months.** Build delivery history.
2. **Don't change shipping addresses right before drops.** Target's risk score takes weeks to settle on a new address.
3. **For pickup orders (Target Drive-Up, Walmart Pickup, Best Buy Pickup): use the store closest to your billing address.** Geographic mismatch is a flag.
4. **If you must use a CMRA for daily mail**, keep your retailer accounts pointed at your real residential address. Use the CMRA only for non-time-sensitive purchases.
5. **Family addresses are fine for occasional drops** but not as your default — `(name, address)` tuple checks see "John Smith" ordering at "Mike Jones's house" and flag.

The pattern that wins: real residential address, used consistently for 6+ months, matched to the name on your account and payment method. Boring beats clever.
""",
    },
    {
        "key": "ips_and_proxies",
        "title": "IPs, proxies & device hygiene",
        "summary": "How retailers flag 'not a normal shopper.' Stay on the legitimate side and you're invisible.",
        "sort_order": 8,
        "curated_md": """\
Retailers stack three layers of detection — **IP reputation**, **browser fingerprint**, and **behavioral biometrics**. Stay on the legitimate side of each and you're invisible. Try to game them and the signals stack against you.

## Layer 1: IP reputation

| IP type | Trust score | When it's normal |
|---|---|---|
| **Home residential ISP** (Comcast, AT&T, Spectrum) | High | Default personal browsing — what you want |
| **Mobile carrier** (Verizon, T-Mobile cellular) | Medium-high | Phone or tethered laptop |
| **Office / business ISP** | Medium | Working from work — coworkers' activity affects you |
| **Datacenter** (AWS, Hetzner, Linode) | Very low | Servers, headless tools — flags hard |
| **VPN** (NordVPN, ExpressVPN) | Low | "Privacy" marketing but datacenter-IP under the hood |
| **Tor exit node** | Blocked | Almost always blocked outright |
| **Public-place wifi** (coffee shop, hotel) | Low-medium | Shared with everyone in that location, including bots |
| **Residential proxy** (rotating consumer IPs) | High at low volume | What scrapers buy to look real |

### Why VPN during checkout is bad

Most consumer VPNs route through datacenter IPs despite the "privacy" branding. Cloudflare and Akamai maintain VPN-IP databases and flag accordingly. The IP geolocation usually doesn't match your billing/shipping zip either, which compounds the flag.

**If you want privacy during checkout, your home ISP IP IS already private** — single household, not shared with strangers. A VPN makes you *more* trackable to retailers, not less.

## Layer 2: browser fingerprint

Beyond your IP, retailers fingerprint the browser:

- **Canvas fingerprint** — how your GPU renders text/shapes
- **WebGL fingerprint** — GPU capabilities
- **Audio fingerprint** — audio context output
- **Font enumeration** — which fonts are installed
- **Screen resolution + DPI**
- **Time zone** (must match IP geo)
- **Language preferences** (must match)
- **Browser plugins / extensions**
- **TLS handshake fingerprint** (JA3 / JA4)

A normal Chrome on macOS at home has a stable fingerprint for months. A "fresh" session — incognito, cookies cleared, extensions disabled — paradoxically looks *more* bot-like because most humans don't browse that way. **Browse normally; don't try to hide.**

## Anti-detect browsers — what they are

Anti-detect browsers (**Multilogin, AdsPower, Kameleo, GoLogin, Linken Sphere, Octobrowser**) generate synthetic randomized browser fingerprints that combine with proxy IPs to make each "session" look like a different real user. Used by:

- Affiliate marketers managing multi-client ad accounts (legitimate)
- Multi-store e-commerce sellers (legitimate)
- Sneaker / TCG bots running multi-account checkout (TOS violation)

**Retailers fight them via:**
- Akamai / Cloudflare maintain anti-detect-tool fingerprint databases
- TLS JA3/JA4 inconsistencies across "different" sessions from one physical machine
- Behavioral entropy (real users don't generate 50 distinct sessions/day)
- Cross-session correlation (cookie patterns, click patterns, payment-method reuse)

**Honest take**: if you use anti-detect to run **one normal account from one normal household**, you're paying for tooling you don't need — your home browser already does this honestly. If you use it to run **multiple accounts at the same retailer**, you're violating "one account per person" TOS at every major retailer (Target, Walmart, Best Buy, Pokemon Center all explicitly forbid this).

The reseller community over-uses anti-detect browsers. **Aged organic accounts (1+ year, real history, no proxy) outperform stacked anti-detect setups on cancellation rate.** The boring profile wins long-term.

## Layer 3: behavioral signals

Even with perfect IP and fingerprint, retailers track behavior:

- **Form fill speed** — 100ms autofill is bot. 3–15s typing is human.
- **Mouse trajectory** — straight-line clicks are bot. Curves with micro-corrections are human.
- **Scroll patterns** — instant page-down is bot. Scroll-and-pause is human.
- **Tab focus changes** — real users alt-tab during long forms.
- **Time on PDP before add-to-cart** — bots add in <1s; humans browse 10+s.
- **Cart-to-checkout latency** — <2s is bot territory; 30s–5min is normal.
- **Total time on site per drop** — <2min total = drop sniper. 5–30min = normal shopper.

## The legitimate hygiene rules

For one account, your real address, no shenanigans:

- ✅ Your home wifi (residential ISP)
- ✅ Your real Chrome / Safari profile with your normal extensions
- ✅ Mobile app on your phone (lighter fingerprinting; "logged-in app" trust score)
- ✅ Browse a few minutes before checkout — let your behavior look normal
- ✅ Type the last 4 of your card manually if autofill is too fast
- ❌ Don't VPN during checkout
- ❌ Don't use Incognito for hot drops (cleared cookies = looks bot-like)
- ❌ Don't disable JavaScript or block fingerprinting
- ❌ Don't run multiple browsers / devices on the same drop
- ❌ Don't run an anti-detect browser unless you have a legitimate multi-client professional reason

## On the "proxy + browser" pattern your friend uses

The pattern of "anti-detect browser + proxy + new account per drop" is the textbook scalper setup. It violates retailer TOS at every major chain and is the exact behavior their engines are built to catch. It works occasionally on smaller retailers; it gets cancelled aggressively at Target, Walmart, Best Buy, and Pokemon Center.

Even if your friend has been getting away with it, the trend is clear: **detection is improving faster than evasion tools**. The ROI window keeps narrowing. Most cook-group veterans now run aged organic accounts because the multi-account stack has stopped paying.

For sustained, low-cancel reselling, age one account per retailer over months, build trust normally, use store pickup wherever possible, and accept that you'll lose some hot drops. That math beats the stacked-account math over a 12-month horizon.
""",
    },
    {
        "key": "general",
        "title": "Universal account-health principles",
        "summary": "Cross-retailer rules of the road. Read this first.",
        "sort_order": 0,
        "curated_md": """\
Most cancellation engines run on the same handful of signals. Get these right
across the board and you'll have far fewer surprises.

## What every retailer's risk engine looks at

| Signal | Why it matters |
|---|---|
| **Account age + order history** | A 2-year-old account with regular non-resale orders is treated very differently from a 2-week-old account ordering 5x ETBs |
| **Phone verification** | Phone-verified accounts get higher trust scores; unverified is a soft flag |
| **Address consistency** | First-time shipping address on a high-value drop is a red flag |
| **Payment method age** | Card added 5 minutes before checkout = flagged. Card on file for months = trusted |
| **Velocity** | Multiple orders of the same SKU within 24h, even across accounts at the same address, is the #1 cancellation cause |
| **Navigation pattern** | Direct-to-cart with no browsing history looks scripted |
| **Checkout speed** | Sub-30-second checkout looks bot-like; 2–5 minutes is normal |
| **IP reputation** | VPN, Tor, recent suspicious activity from your IP — all bad |

## Things to do (boring but they work)

- **One account per household.** Multiple accounts at the same shipping address is the single fastest way to get *all of them* flagged simultaneously
- **Build order history before drops.** A few weeks of normal $20–$50 orders dramatically improves trust
- **Phone-verify everything.** Costs nothing, big trust bump
- **Add card + address well in advance.** Not the day of the drop
- **Use the official mobile apps** when possible — fingerprinting is lighter and "logged-in app user" is a higher-trust profile than "new browser session"
- **Don't use a VPN during checkout** — even if it's "private," it looks like proxy traffic
- **Avoid CMRA addresses** (commercial mail receiving agencies — UPS Store mailboxes, etc.). They're on shared lists and get flagged across retailers

## Things to avoid

- ❌ Multiple browsers / Incognito sessions for "extra orders"
- ❌ Prepaid Visa / Mastercard — top cancellation trigger on hot drops
- ❌ Adding a new shipping address minutes before checkout
- ❌ Quantity that's higher than the order limit (the system will silently 0 your order if it goes over)
- ❌ Checking out at the absolute moment of restock (looks scripted; wait a moment)
- ❌ Using browser autofill to populate the entire form in <2 seconds

## "Got cancelled" — common reasons

- Velocity (you or your household placed too many orders too fast)
- Address mismatch with your account history
- Payment didn't authorize (CVV, expired, declined)
- Item quantity exceeded the per-customer limit
- Address flagged on a known reseller list
- Item just oversold and inventory got reconciled
""",
    },
    {
        "key": "target",
        "title": "Target — RedCard, store-pickup, and the cancellation engine",
        "summary": "RedCard age + drive-up pickup are your friends. Ship-to-home is where most cancellations happen.",
        "sort_order": 10,
        "curated_md": """\
Target's risk engine is moderate-aggressive on hot drops (Pokemon ETBs, console restocks, sneaker collabs). Most cancellations come from velocity + ship-to-home flags rather than bot detection per se.

## Why orders get cancelled at Target

- **Order velocity across the household IP.** Target tracks (account, address, payment) tuples. Multiple accounts ordering the same SKU from the same address within minutes = all cancelled
- **Quantity over the per-customer limit.** Target enforces silently; if the SKU has a 2-per-customer cap and you have 3 in cart, the order may go through and then get cancelled hours later
- **Brand-new account + first-time payment + first-time address all on a hot SKU.** Triple flag
- **Address flagged as commercial / mailbox forwarder**
- **Pickup chosen but you've never picked up before from that store** — soft flag, usually just delays

## Account health

- Use a Target account **6+ months old** with normal order history (groceries, household stuff)
- **Get a RedCard** (debit or credit). RedCard accounts are KYC-verified and get noticeably reduced cancellation risk on drops. Plus 5% off
- Phone-verify your account
- **Don't change your default address before a drop** — Target trust score takes weeks to "settle" on a new address

## Payment

- **Best:** RedCard (debit or credit), Apple Pay tied to a known card on file
- **OK:** credit card on file for 30+ days
- **Risky:** newly added cards, Visa gift cards
- **Cancellation magnet:** prepaid Visa/Mastercard

## Pickup vs Ship-to-Home

| Method | Cancellation rate (anecdotal) |
|---|---|
| **Drive-Up / Order Pickup** | Very low — ~5–10% |
| **Ship-to-Home (in-stock items)** | Low-moderate — ~10–15% |
| **Ship-to-Home (hot drops)** | Moderate — ~20–40% |

**Use Drive-Up wherever you can.** It's the single highest-impact change you can make to reduce cancellations on Pokemon drops.

## Drop-day behavior tips

- Open the Target app/site 10+ minutes before the drop, browse a couple of unrelated categories
- Add to cart manually (don't paste a direct cart URL)
- Spend 1–2 minutes on the cart/checkout screens
- One device, one tab
- Don't refresh aggressively; the SKU appearing in your cart means you're probably good

## Pokemon-specific

- Target frequently caps Pokemon ETBs at 2 per customer per drop
- TCG sets often launch online before in-store; ship-to-home cancellation rate is highest in the first hour
- Pickup at your "home" Target almost always honored even on contested drops
""",
    },
    {
        "key": "walmart",
        "title": "Walmart — the strictest cancellation engine of the big three",
        "summary": "Walmart cancels more aggressively than Target or Best Buy. Build account history; use Walmart+ if you can.",
        "sort_order": 20,
        "curated_md": """\
Walmart's risk engine is the most aggressive of the major box stores for hot drops. They cancel high volumes of "looks like reseller" orders without notice. The pattern they look for is sharper than Target's.

## Why orders get cancelled at Walmart

- **New / fresh accounts on hot SKUs.** Walmart treats <90-day accounts as suspicious by default for high-demand drops
- **Velocity** — same as everyone, but their threshold is tighter (multiple orders of similar items within an hour = cancellation)
- **Address-payment mismatch** — billing zip ≠ shipping zip ≠ account zip is a classic cancel trigger
- **Items priced below cost** — Walmart's pricing-error cancellation is famous; if a SKU was mispriced, ALL orders for it get cancelled and refunded with an apology email
- **Quantity flag** — buying 3+ of a hot item is rarely honored even if order goes through
- **Reseller-known addresses** — UPS Store / mail forwarder zip+address combos are on a shared list

## Account health

- Walmart account **90+ days old** with regular order history
- **Walmart+ membership** ($98/year) is the single highest-impact trust signal. W+ accounts have noticeably lower cancellation rates and get earlier access to drops
- Phone verification + email verification both done
- Linked credit card on file 30+ days
- Default address has had at least 2–3 successful deliveries

## Payment

- **Best:** card on file 30+ days, Walmart Pay through the app
- **OK:** PayPal linked to a verified account, Affirm
- **Risky:** newly added cards, gift cards
- **Auto-cancel:** prepaid Visa, certain virtual cards (Privacy.com is hit-or-miss)

## Shipping vs Pickup

| Method | Cancellation rate (anecdotal) |
|---|---|
| **Free Pickup at store** | Low — ~10% |
| **2-Day shipping** | Moderate — ~15–25% |
| **Express / hot-drop shipping** | High — ~30–50% |

**Pickup is even more important at Walmart than at Target.** When the SKU offers it, take it.

## Drop-day tips

- Use the **Walmart app**, not the website. Mobile-app trust is higher
- Be logged in 10+ minutes before the drop
- One item per order, not multi-cart bundles, on hot SKUs
- Don't switch shipping addresses in the last minute
- If your order lands in "Processing" for 4+ hours, it's probably cancelling — don't celebrate yet

## After cancellation

- Walmart's "cancelled" reasons in the email are mostly canned — don't trust the literal text
- Refunds usually post in 3–5 business days; if it's longer, dispute via chat
- Repeated cancellations don't ban you, but they don't help your trust score either
""",
    },
    {
        "key": "bestbuy",
        "title": "Best Buy — MyBestBuy + total tech support members get priority",
        "summary": "Best Buy cancels less than Walmart but enforces strict per-customer limits. Membership matters.",
        "sort_order": 30,
        "curated_md": """\
Best Buy's risk engine is moderate. They lean less on bot detection and more on per-customer limits + membership tiering. Cancellations on hot drops (PS5, GPUs, Pokemon) are common but mostly tied to clear policy violations.

## Why orders get cancelled at Best Buy

- **Per-customer limit hit** — Best Buy enforces "1 per customer" on most hot drops; 2nd order = automatic cancel even if the order went through initially
- **Same payment + shipping across multiple accounts** — they check tuples just like Target
- **High-velocity orders** during launch windows
- **Recent payment-method changes** on accounts with little history
- **Trade-in fraud flags** can spill over into normal orders

## Account health

- **MyBestBuy Plus / Total ($49.99 / $179.99/yr)** members get measurably lower cancellation rates and early-access windows on drops. If you're going to buy 2+ hot SKUs/month, Total is worth it
- Phone-verified, email-verified
- A few completed orders in the last 60 days

## Payment

- **Best:** Best Buy credit card, Apple Pay
- **OK:** any card on file 30+ days
- **Risky:** newly added card on a cold account
- **Avoid:** prepaid cards on hot drops

## Shipping vs Pickup

| Method | Cancellation rate (anecdotal) |
|---|---|
| **Store Pickup** | Very low — ~5% |
| **Standard shipping** | Low — ~10% |

Best Buy pickup is essentially never cancelled if the store has stock. **Use it.**

## Drop-day tips

- Be logged in to the app/site before the drop
- Best Buy "drops" are usually announced ahead — set a calendar reminder
- One item, one order, on hot SKUs (because of the per-customer limit)
- If you have Total/Plus, use the early-access window — it's the easiest legit win

## What "cancelled" usually means at Best Buy

- "Limited to 1 per customer" — you tried 2nd order
- "Out of stock" — they oversold
- "Address mismatch" — first-time billing/shipping combo flagged
- "Suspicious activity" — usually means velocity or VPN
""",
    },
    {
        "key": "gamestop",
        "title": "GameStop — pre-orders rarely cancel, ship-to-home occasionally does",
        "summary": "GameStop's risk engine is light but their stock is genuinely smaller. Pickup orders almost always honored.",
        "sort_order": 40,
        "curated_md": """\
GameStop has the lightest bot/cancellation engine of the big-five we monitor. Their challenges are more about stock scarcity and shipping logistics than cancellation policy.

## Why orders get cancelled at GameStop

- **Inventory reconciliation** — GameStop's per-store stock counts can be off. Order goes through, store can't find the unit, they refund. Not a "you" problem
- **Address validation** — bad zip, mismatched apartment number → cancel
- **Pre-order conversion mismatches** — when a pre-order item launches, sometimes the SKU/distribution shifts and you get refunded

## Account health

- A normal GameStop account is fine. They don't tier customers as much as Target/Best Buy
- **PowerUp Rewards Pro ($14.99/yr)** gets you trade-in bonuses and some early-access; minor cancellation impact
- Email verified

## Payment

- All major cards work. GameStop's payment validation is light
- No special concerns about gift cards (GameStop sells gift cards as a primary product)

## Shipping vs Pickup

| Method | Cancellation rate (anecdotal) |
|---|---|
| **Store Pickup** | Almost zero (when in-stock) |
| **Ship-to-Home** | Low (~10%) — mostly inventory reconciliation issues |
| **Pre-order Ship** | Very low (~5%) |

## Pokemon-specific

- GameStop is **$5–10 over MSRP** on most TCG products but compensates with frequent **"Buy 2 Get 1 Free"** promos
- Pre-orders for Pokemon TCG sets are the highest-success path: pre-order opens, you order, item ships on launch day
- Per-customer limits exist but are less aggressively enforced than at Target/Best Buy
- Trade-in rewards can offset the markup if you trade old games

## Drop-day tips

- The combined `Stores-FindStores?products=<pid>` endpoint we use for monitoring is the same one their site uses, so your monitor is seeing the same data their PDP shows. When it says in-stock at your local store, it's almost always honored
- Use store pickup
""",
    },
    {
        "key": "samsclub",
        "title": "Sam's Club — membership-walled, cancellations rare but stock is the problem",
        "summary": "Member-only ordering means low fraud risk. Cancellations are usually inventory issues, not engine flags.",
        "sort_order": 50,
        "curated_md": """\
Sam's Club's whole ordering experience is membership-walled — you can't buy without a paid Club or Plus account. That means their fraud engine is lighter than open marketplaces because there's already KYC + recurring billing tying every account to a real human.

## Why orders get cancelled at Sam's Club

- **Inventory desync** — the most common reason by far. Stock count says 5, club only has 1, your order gets refunded
- **Membership lapse** — if your card on file fails for the membership renewal during your order, the order can hold/cancel
- **Quantity over store-allocated cap** — Sam's allocates inventory per club; ordering more than the club's allocation = automatic cancel
- **Address validation** for Plus/free shipping — must be in delivery zone

## Account health

- Active Club ($50/yr) or Plus ($110/yr) membership in good standing
- Phone verified
- Order history of pickup/delivery from your home club

## Payment

- Membership card on file usually fine
- All major cards
- Sam's MasterCard members get 5% on travel + dining (irrelevant to Pokemon but signals trust)

## Shipping vs Pickup

| Method | Cancellation rate (anecdotal) |
|---|---|
| **Curbside Pickup** | Low — ~10% (mostly inventory) |
| **Free shipping (Plus)** | Low (~15%) |
| **Standard shipping** | Moderate (~20%) |

## Pokemon-specific

- Sam's gets **bulk-pack Pokemon** (collection boxes, ETB cases) 2–4× a year
- These are the highest-margin per-pack Pokemon buys outside Costco
- They drop without warning — monitor + drive

## On the membership cookie

The way ResellIQ talks to Sam's Club is via your logged-in browser cookie. If your mom logs in on her phone, your cookie *might* invalidate. The system will SMS you when this happens — just paste a fresh cookie from DevTools.
""",
    },
    {
        "key": "costco",
        "title": "Costco — basically can't be monitored online; in-person rules",
        "summary": "No public per-warehouse stock data. Drop on Tuesday/Friday mornings. Bring your card.",
        "sort_order": 60,
        "curated_md": """\
Costco doesn't expose per-warehouse inventory anywhere we can monitor. Their cancellation engine for the rare online drops is strict but you'll mostly be buying in-person.

## In-warehouse buying

- **Truck arrivals are typically Monday/Tuesday/Friday early morning**. New product hits the floor by 10am
- Pokemon bulk packages (collection boxes, multi-ETB bundles) appear 2–4× a year, usually around new-set launches
- Per-member quantity limits are sometimes posted (e.g., "limit 2") and aggressively enforced at checkout
- Pricing is typically slightly below MSRP per pack

## Online ordering

- Costco.com has a tiny TCG selection compared to in-warehouse
- Cancellation engine is light but inventory desync is common
- Free shipping on most items at Plus tier

## Membership

- Standard Gold Star ($65/yr) or Executive ($130/yr)
- Membership in good standing required for any purchase

## Why this monitor doesn't cover Costco

- No public per-warehouse stock API
- BrickSeek aggregates some Costco data but coverage is patchy and TOS-grey
- For the rare moments Costco gets Pokemon online, manual checking works

## Tactical advice

- If you live near a Costco, **make a habit of walking past the toy/seasonal aisle on Tuesday/Friday mornings**
- Talk to the manager if you're a regular — they'll often tell you when a pallet of TCG is coming
- Pokemon Center / Hasbro distribution is irregular; Costco can have it for 2 weeks then nothing for 3 months
""",
    },
    {
        "key": "pokemoncenter",
        "title": "Pokemon Center — deep cancellation analysis",
        "summary": "Cloudflare + Queue-It + custom risk scoring. The most aggressive consumer-facing engine of any retailer we cover.",
        "sort_order": 70,
        "curated_md": """\
Pokemon Center runs **Cloudflare + Queue-It + a custom risk-scoring layer** and has years of history fighting scalper scripts. The thing to understand: PC doesn't fight bots to slow them down — they fight bots so legitimate fans can buy. Respect the queue and you have a real shot. Try to optimize around it and you'll be at the top of the cancel list.

## How a PC drop works

1. Drop time is announced (sometimes — many are surprise)
2. You click the product → Queue-It assigns a queue position
3. You wait. 30s to 2hr depending on demand
4. Queue-It releases you to the cart
5. You have a **timed cart** (10–15 min) to check out
6. Order placed → 1–6 hours later, risk-scoring may reverse-cancel

## Cancel hit list (in approximate order of frequency)

1. **Same-address multi-order** — top reason. PC checks (account email, shipping address, payment method) tuples and silently cancels duplicates when stock reconciliation runs.
2. **Datacenter or VPN IP at checkout** — Cloudflare flags during the queue itself; you may make it through but cancel hits later.
3. **Address change within 30 days of high-value order** — if shipping doesn't match your account's last 30–90 days, score drops.
4. **CMRA / mail forwarder address** — shared blocklists with TCGPlayer, eBay, etc. Instant cancel.
5. **Newly added payment method** — especially gift cards or non-Visa/MC.
6. **Multi-device queue presence** — phone + laptop + tablet with same PTC account = all positions invalidated.
7. **Cart timeout** — 10–15min hard cap. Don't wander off.
8. **Quantity exceeding per-customer limit** — silently allowed at order-place, reverse-cancelled hours later.
9. **Velocity flag** — second order within 24h of a hot drop is risky even on a different SKU.
10. **PTC account age** — accounts <30 days on a hot drop are cancellation candidates.
11. **Bulk SKU stacking** — buying every variant of a release (e.g., all 6 booster boxes) triggers anti-arbitrage rules.
12. **Email + name + payment mismatch** — different names on PTC account vs payment method = cancel.

## What gets checked at each layer

### Cloudflare (entry — gates whether you reach PC at all)
- IP reputation (residential vs datacenter vs VPN vs Tor)
- TLS / JA3 / JA4 fingerprint
- Browser fingerprint (canvas, WebGL, fonts, screen, plugins, time zone)
- Request rate from your IP

### Queue-It (assigns + holds your queue position)
- Single device per queue position — phone OR laptop, not both
- No multiple-tab parallelism from the same browser
- No queue-position trading via shared sessions
- Aggressive refreshing = position invalidated

### PTC account / order layer
- Account age (preferably 6+ months)
- Phone + email verification
- Order history (any prior PC purchases, even small)
- Payment method age on file
- Shipping address consistency over last 90 days
- Same-address-multi-account check

### Behavioral signals during checkout
- Autofill speed (form populating in <1s is bot-like; 5–15s is human)
- Mouse movement before clicks (none = bot; even slight = human)
- Field focus order (jumping non-sequentially can flag)
- Submit-button click latency

## Pre-drop checklist (do these BEFORE the drop)

- ✅ PTC account 6+ months old, phone + email verified
- ✅ Default shipping address identical to last 3+ orders
- ✅ Payment method on file 60+ days
- ✅ Logged in on **one** device only
- ✅ Home residential IP (no VPN, no public wifi)
- ✅ Latest Chrome / Safari (not headless, not anti-detect)
- ✅ Cart cleared of any old items
- ✅ Visit the product page so it's in your browser history
- ✅ Phone within reach for SMS verification if asked
- ❌ Don't open multiple tabs
- ❌ Don't enable browser extensions that modify pages
- ❌ Don't autofill via password manager faster than 3 sec
- ❌ Don't refresh the queue widget
- ❌ Don't switch networks (home wifi → cellular) mid-flow

## If you got cancelled

PC sends a vague "We were unable to process your order" email. Don't argue via support — they cite policy and rarely reverse on hot drops. Instead:

1. Note the date / SKU / order # in your **Your notes** section below
2. Identify the most likely flag (newly added address? Privacy.com? multiple devices in queue? velocity?)
3. Fix that one variable for next drop
4. After 3–4 cancels in a row the account may be on a watch list — consider stepping back from PC for 2–3 weeks before retrying

## Why PC's protection actually helps you

PC is one of the few sites where bot protection is *meaningfully effective at protecting legitimate buyers from scalpers*. The queue + risk-scoring stack is annoying, but it's also the reason a normal fan with an aged PTC account can still get into the queue at all. Respect the system and your win rate will be higher than you'd expect.
""",
    },
]
