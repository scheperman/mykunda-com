# MyKunda — Backend Setup (Phase 1)

This folder turns the MyKunda website from a prototype into a live platform:
real accounts, real listings, and **every form emails you a lead**.

Stack: **Supabase** (Postgres + Auth + Storage + Edge Functions) and **Resend** (email).

> You only do this **once**. Times are rough estimates for a first-time setup.

---

## 0 · What you need (5 min)
- A **Supabase** account → https://supabase.com (free tier is fine)
- Your **Resend** account + API key (you have this) → https://resend.com
- Your domain **mykunda.com** (for email sending + the live site)
- Lead inbox: **info@mykunda.com**

---

## 1 · Create the database (10 min)
1. In Supabase, create a new project. Pick a region close to your users (e.g. **EU West**).
2. Open **SQL Editor → New query**.
3. Paste the entire contents of [`schema.sql`](./schema.sql) and click **Run**.
   - Creates all tables, enums, triggers, row-level-security policies, and helper functions.
   - Safe to re-run if needed.
4. **Make yourself admin.** In SQL Editor run (after you've signed up once in step 4):
   ```sql
   update public.profiles set role = 'admin' where email = 'info@mykunda.com';
   ```

---

## 2 · Create storage buckets (3 min)
Supabase → **Storage → New bucket**:
| Bucket | Public? | Holds |
|---|---|---|
| `listing-photos` | ✅ Public | property photos, floor plans, 360° |
| `listing-docs`   | ⛔ Private | title deeds & ownership documents |

---

## 3 · Connect the website (5 min)
1. Supabase → **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
2. Open [`/supabase.js`](../supabase.js) (in the site root) and fill in:
   ```js
   const MYKUNDA_SUPABASE_URL  = "https://YOUR-PROJECT.supabase.co";
   const MYKUNDA_SUPABASE_ANON = "YOUR-ANON-PUBLIC-KEY";
   ```
   The anon key is **safe** in frontend code — row-level security protects the data.
3. On each page, the Supabase library + this file load **before** `app.js`:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   <script src="supabase.js"></script>
   <script src="app.js"></script>
   ```
   > Until you fill in the keys, the site runs in **demo mode** (works exactly as the
   > prototype does now). The moment the keys are present, it talks to the real backend.

---

## 4 · Turn on Auth (5 min)
Supabase → **Authentication → Providers**:
- **Email**: enable. (For quickest launch, turn *off* "Confirm email" while testing.)
- **Phone (SMS OTP)**: optional but ideal for The Gambia — needs an SMS provider
  (Twilio/Vonage) configured in Supabase. Can be added later.

Then sign up once with **info@mykunda.com** and run the admin SQL from step 1.4.

---

## 5 · Email + Edge Functions (15 min)
This is what makes "we'll email you" real.

### a. Verify your domain in Resend
Resend → **Domains → Add** `mykunda.com`, add the DNS records it shows
(SPF + DKIM). This lets email send from `noreply@mykunda.com`.

### b. Install the Supabase CLI
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
```

### c. Set secrets (server-side — never in frontend code)
```bash
supabase secrets set RESEND_API_KEY=re_...           # from Resend → API Keys
supabase secrets set LEAD_EMAIL=info@mykunda.com     # where enquiries land
supabase secrets set FROM_EMAIL="MyKunda <noreply@mykunda.com>"
```
> ⚠️ The key that was pasted in chat (and previously printed here) must be
> **rotated** in Resend — treat it as public. Never write the real key into a
> file in this project.
> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.
> `LEAD_EMAIL` is the canonical name; `notify-lead` and `resend-webhook` also
> accept `ADMIN_EMAIL` as an alias, and all three functions default to
> `info@mykunda.com` when neither is set.

### d. Deploy the functions
```bash
supabase functions deploy notify-lead     --no-verify-jwt
supabase functions deploy notify-viewing  --no-verify-jwt
supabase functions deploy notify-listing  --no-verify-jwt
supabase functions deploy auth-email      --no-verify-jwt
```
Run [`lead-notify-status.sql`](./lead-notify-status.sql) once as well — it adds
`notified_at` / `notify_error` to `leads` (so a Resend failure shows up on the
lead row instead of only in the function logs) and adds the missing
`leads admin delete` RLS policy that the admin console's delete button needs.

That's it — submit the valuation form and a lead lands in `info@mykunda.com`,
with an auto-reply to the user.

### e. Auth emails (password reset, magic link) — no Custom Domain add-on
By default Supabase's own mailer sends auth emails from *and links to*
`<project-ref>.supabase.co`. Making the sender **and** the link both read
`mykunda.com` normally needs Supabase's paid **Custom Domain** add-on
(~$10/mo/project).

`auth-email` avoids that: it builds the action link itself with
`supabase.auth.admin.generateLink()` and sends it through Resend — same
sender as every other MyKunda email (`noreply@mykunda.com`), and the link
in the email points at `mykunda.com/auth.html`, never at Supabase's domain.
The site already calls it (`sendPasswordReset()` in `supabase.js`) instead
of `supabase.auth.resetPasswordForEmail()` for "Forgot password". The same
function can send signup-confirmation emails later if "Confirm email" gets
turned on — see the comment next to `sendMagicLink()`/the `signup` case in
`edge-functions/auth-email/index.ts`.

---

## 6 · Email deliverability alerts (Resend webhook)
By default, bounces, spam complaints and send failures only show up if you go
looking in the Resend dashboard. `resend-webhook` wires them into MyKunda instead:
every event is logged, bounces/complaints flag the lead's email, and the team
gets an alert email for anything that needs attention.

1. Run [`email-events.sql`](./email-events.sql) once in the SQL Editor — creates
   `email_events` and adds `email_bounced_at` / `email_bounce_reason` to `leads`.
2. Deploy the function:
   ```bash
   supabase functions deploy resend-webhook --no-verify-jwt
   ```
3. Set the signing secret (printed once when the webhook was created — see chat;
   generate a new one from Resend → Webhooks → this endpoint if it's been lost):
   ```bash
   supabase secrets set RESEND_WEBHOOK_SECRET=whsec_...
   ```

Already configured on the Resend side: a webhook on `mykunda.com` posts
`email.bounced`, `email.complained`, `email.delivery_delayed`, `email.failed`,
and `email.suppressed` to the function. Point it at the standard endpoint —
`https://jejaerpqltqryqzjvbjp.supabase.co/functions/v1/resend-webhook` — rather
than the legacy `*.functions.supabase.co` host, which answers with a bare
gateway error when a function is missing.

**DMARC (optional, do at your DNS provider):** Resend doesn't manage this record,
but it helps inbox placement. Add a TXT record:
`_dmarc` → `v=DMARC1; p=none; rua=mailto:info@mykunda.com`

---

## 7 · Go-live checklist
- [ ] `schema.sql` run; you are `admin`
- [ ] Buckets `listing-photos` (public) + `listing-docs` (private) created
- [ ] Keys filled into `supabase.js`
- [ ] Email + (optional) phone auth enabled
- [ ] `mykunda.com` verified in Resend
- [ ] All three edge functions deployed (`notify-lead`, `notify-viewing`, `auth-email`); secrets set
- [ ] `resend-webhook` deployed (`email-events.sql` run; `RESEND_WEBHOOK_SECRET` set)
- [ ] DMARC TXT record added at your DNS provider
- [ ] **Resend key rotated**
- [ ] **MapTiler key restricted** to `mykunda.com`
- [ ] Test: sign up · create a listing · approve it · submit each form · confirm email arrives

---

## What's wired where
| Form on the site | Calls (in `supabase.js`) | Result |
|---|---|---|
| Valuation (Home) | `submitLead('valuation', …)` | lead row + team email + auto-reply |
| List a property  | `createListing()` + `uploadListingMedia()` | listing in `pending_review` |
| Request viewing  | `requestViewing()` | viewing row + seller email |
| Propose slots    | `proposeSlots()` | buyer email with the 3 times |
| Message agent    | `submitLead('agent_message', …)` | lead + notification |
| Contact page     | `sendLead('contact', …)` | lead + team email (reply-to = visitor) + auto-reply |
| Free consultation (Sell) | `sendLead('consultation', …)` | lead + team email + auto-reply |
| Area alerts      | `saveSearch()` | saved search row |
| Sign in / up     | `signInEmail` / `signUpEmail` / `signInPhone` | real session |
| Forgot password  | `sendPasswordReset()` | Resend email, `mykunda.com` link — no Custom Domain add-on |
| Market index (Admin) | `fetchMarketSnapshots()` · `rebuildMarketIndex()` · `addMarketObservation()` | monthly price development in `market.html` |

Files:
- `schema.sql` — database + security
- `../edge-functions/` — every edge function lives here, on one shared
  `_shared/email-template.ts`. There used to be a second copy under
  `backend/functions/` with an older template; it was removed on 11 Aug 2026.
- `../supabase.js` — frontend client + all helper calls

## Daily dalasi rate (fx-rates)

The dalasi is not in the ECB feed, so it is pulled from the **Central Bank of
The Gambia daily valuation rates** — the official published rate.

**Setup, once:**

1. Run `backend/fx-rates.sql` in the SQL editor. It creates `fx_rates`,
   `fx_rate_rejects`, the read policy, and seeds the rate the site shipped with.
2. `supabase functions deploy fx-rates --no-verify-jwt`
3. Schedule it (pg_cron + pg_net enabled), replacing `<project>`:

   ```sql
   select cron.schedule('fx-rates-daily', '0 13 * * 1-5',
     $$ select net.http_post(
          url := 'https://<project>.functions.supabase.co/fx-rates',
          headers := '{"Content-Type":"application/json"}'::jsonb,
          body := '{"refresh":true}'::jsonb) $$);
   ```

**How the site uses it:** `app.js` GETs the function once per 12 hours, caches the
result in `localStorage`, and shows the publication date in the currency picker
("Rate of 25 Jul 2026 · Central Bank of The Gambia").

**Guardrails**

| Situation | What happens |
|---|---|
| CBG page unreachable or unparseable | Nothing is written; the last stored rate stays live |
| Published rate moves more than 3% in a day | Rejected, logged to `fx_rate_rejects`, old rate kept |
| Rate older than 7 days | Site says "Last confirmed rate: …"; admin console warns |
| Function not deployed at all | Falls back to the built-in rate; site still works |
| Admin sets a manual override | Override always wins; automatic fetch is skipped entirely |

**Important:** rates only affect *display* conversions. Listing plan prices live in
`PRICING` in `app.js` and never change automatically — the admin panel reports the
drift and asks you to re-round them deliberately.

---

## Market index (monthly price development)

Tracks what property and land actually do, month by month, and shows it in the
backoffice at **`market.html`** (Admin console → Market index).

**Setup, once:**

1. Run [`market-index.sql`](./market-index.sql) in the SQL editor. It adds
   `sold_price` / `sold_at` to `listings`, creates `listing_price_events`,
   `market_observations`, `market_snapshots` and `market_index_runs`, installs the
   rollup functions and RLS, backfills an opening price event for every existing
   listing, and builds the last 24 months.
2. Schedule the two jobs (pg_cron) — both are at the bottom of the file:

   ```sql
   select cron.schedule('market-index-monthly', '15 2 1 * *', $$
     select public.market_build_month((date_trunc('month', now()) - interval '1 day')::date);
     select public.market_recompute_derived();
   $$);
   select cron.schedule('market-index-daily', '45 2 * * *', $$
     select public.market_build_month(current_date);
     select public.market_recompute_derived();
   $$);
   ```

   The monthly job closes the month that just ended; the daily job keeps the
   running month fresh so the console is never more than a day behind.

**Where the numbers come from**

| Source | Captured by |
|---|---|
| Asking price of everything on the market | `market_pool()`, per month |
| Every price change | trigger → `listing_price_events` (`change`) |
| Closing price when a listing goes to sold/let | trigger → `sold_price`, `sold_at`, event `sold` |
| Off-platform deals (notary, agent, own research) | admin adds them in `market.html` → `market_observations` |

**What gets written** — one `market_snapshots` row per month × segment × sale/rent:
median price, median price per m², index (first tracked month = 100), MoM, YoY,
listings on the market, new, closed, price cuts, sample size. Segments: whole
market, land vs built, land by area, built by area, area, region, property type.

**Guardrails**

| Situation | What happens |
|---|---|
| Fewer than 5 listings in a segment that month | Median pooled over 3 months, row flagged `thin`, badge shown in the console |
| One big villa enters a small area | Index/MoM/YoY run on price per m², not on the raw median, so the mix can't fake a boom |
| A quiet month for plots | The whole-market index is a sample-weighted composite of the land and built indices |
| Listing repriced after listing | The month uses the price as it stood at the end of that month, not today's price |
| Tables not created yet | `market.html` falls back to a simulated population and says so |

**Access:** every table is admin-only through RLS. To publish a public market page
later, change the `snapshots admin read` policy to `using (true)` — the table holds
no personal data.
