# High Properties — deployment guide (Vercel + Supabase, ₹0/month)

Two free accounts, no server to maintain, no monthly bill.

- **Supabase** stores listings, enquiries and WhatsApp history (free tier: 500 MB — this site uses a few MB)
- **Vercel** serves the site and runs the API (free tier: 100 GB bandwidth/month)

Total time: about 40 minutes.

---

## Step 1 — Create the database (Supabase)

1. Go to **supabase.com** → sign up (GitHub login is easiest) → **New project**
2. Name it `highproperties`, choose region **Mumbai (ap-south-1)** — closest to your customers
3. Set a database password and save it somewhere safe
4. Wait ~2 minutes for provisioning
5. Open **SQL Editor → New query**, paste the entire contents of `supabase-schema.sql`, press **Run**

You should see "Success". Under **Table Editor** you'll now have `listings` (with your 3 starter properties), `leads`, `wa_conversations` and `staff`.

6. Go to **Project Settings → API** and copy two values:
   - **Project URL** → `https://xxxxx.supabase.co`
   - **service_role** key (under "Project API keys" — click reveal)

> ⚠️ The **service_role** key bypasses all security rules. It goes only into Vercel's environment variables. Never put it in a file you commit, and never in the browser. The `anon` key is the safe public one — this project doesn't need it.

---

## Step 2 — Generate your admin password hash

On your Mac, in the unzipped project folder:

```bash
npm install
npm run hash -- "your-strong-password-here"
```

It prints a line starting `scrypt$16384$8$1$...`. Copy the whole thing.

---

## Step 3 — Deploy to Vercel

### Option A — drag and drop (no Git needed)

1. Go to **vercel.com** → sign up → **Add New → Project**
2. Choose **Deploy from folder** / drag the project folder in
3. Deploy

### Option B — via GitHub (better: auto-deploys on every change)

1. Create a **private** repo on GitHub
2. Push this folder to it (`.gitignore` already excludes secrets and `node_modules`)
3. Vercel → **Add New → Project → Import** that repo

---

## Step 4 — Add the environment variables

**Vercel → your project → Settings → Environment Variables.**
Add each of these to **Production, Preview and Development**:

| Name | Value |
|---|---|
| `SUPABASE_URL` | your Project URL from Step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key from Step 1 |
| `SESSION_SECRET` | run `openssl rand -base64 32` and paste the result |
| `BOOTSTRAP_USER` | `yogesh` |
| `BOOTSTRAP_HASH` | the `scrypt$...` string from Step 2 |

Then **Deployments → ⋯ → Redeploy** (environment variables only apply to new builds).

---

## Step 5 — Test on the Vercel URL first

Vercel gives you `your-project.vercel.app`. Before touching your domain, confirm:

- The three listings appear
- **View All Properties** opens the catalogue
- `/admin.html` — sign in with `yogesh` and your password
- Add a test property → it appears on the homepage
- Submit the enquiry form → it shows in admin → **Leads**

**Do not move to Step 6 until this all works.** If listings show but admin sign-in fails, the environment variables didn't apply — redeploy.

---

## Step 6 — Point your domain

Your DNS is currently managed at **Cloudflare**, and `www` points at the old Vercel project.

**In Vercel:** Project → **Settings → Domains** → add `highproperties.in` and `www.highproperties.in`. Vercel shows the exact DNS records it wants.

**In Cloudflare:** DNS → edit the existing records to match what Vercel showed:

| Type | Name | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Use whatever Vercel displays — those values are the current ones but can change.

> Set the Cloudflare proxy (orange cloud) to **DNS only / grey** for both records. Vercel handles its own SSL, and double-proxying causes redirect loops.

SSL is issued automatically within a few minutes. Your DNS has no MX or TXT records, so nothing else breaks.

---

## Step 7 — WhatsApp automation (optional)

Without this the site still works — every enquiry opens a pre-filled WhatsApp chat.

1. **developers.facebook.com** → create a Business app → add **WhatsApp**
2. Connect **+91 98215 53693** (it must not be active in the normal WhatsApp app — the Cloud API takes the number over)
3. From **API Setup** copy the **Phone number ID** and create a **permanent System User token**
4. Add to Vercel's environment variables:

| Name | Value |
|---|---|
| `WA_PHONE_NUMBER_ID` | from API Setup |
| `WA_ACCESS_TOKEN` | permanent System User token |
| `WA_APP_SECRET` | App → Settings → Basic |
| `WA_VERIFY_TOKEN` | any long random string you choose |
| `WA_OWNER_MSISDN` | `919821553693` |

5. **Webhook** — WhatsApp → Configuration → Callback URL:

```
https://www.highproperties.in/api/webhook
```

Verify token = the same `WA_VERIFY_TOKEN`. Subscribe to **messages**.

6. For the customer auto-reply, create an approved template in **WhatsApp Manager → Message templates**, e.g.

> Hi {{1}}, thanks for contacting {{2}}. We've received your property requirement and will call you shortly.

then set `WA_TEMPLATE_LEAD` to its name.

> **Security note:** the webhook refuses every POST until `WA_APP_SECRET` is set. That is deliberate — without it there is no way to prove a request actually came from Meta, and this endpoint writes to your database.

### What the automation does

| Trigger | Action |
|---|---|
| Enquiry form submitted | Lead saved to Supabase, WhatsApp alert sent to you |
| …and a template is set | Customer gets an instant confirmation |
| Customer messages you | Logged to the CRM inbox; keyword menu auto-replies |
| Customer replies 1/2/3/4 | Routed to buy / sell / rent / construction |

Auto-replies are rate-limited (4 per number per 15 min) so they cannot loop.

---

## Adding properties

**One at a time:** `/admin.html` → *Add / edit* → Save.

**In bulk:** *Import / export* → paste CSV with this header:

```csv
title,type,category,purpose,price,sector,locality,city,beds,area,status,featured
"3 BHK Apartment",Apartment,residential,buy|sell,14500000,"Sector 99","Dwarka Expressway",Gurugram,3,1650,"Ready to Move",yes
```

- `category` — `residential`, `commercial`, `plot` or `industrial`
- `purpose` — `buy`, `sell`, `rent`, `lease`, `collab`, separated by `|`
- `price` — plain rupees, no commas. "₹1.45 Cr" is generated automatically.

### Property photos

Photos are what sell property. Put images in `assets/properties/`, redeploy, then paste the path (`assets/properties/hp-1001.jpg`) into the **Photo URL** field.

4:3 landscape, at least 1200×900, under ~300 KB each. Without a photo the site shows branded architectural artwork, so listings never look broken.

---

## Security checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` exists **only** in Vercel's environment variables
- [ ] `SESSION_SECRET` is 32+ random characters
- [ ] The old admin password (`15461@Delhi`) is retired everywhere — it was public in the old site's source
- [ ] Hostinger account password rotated (it was shared over WhatsApp)
- [ ] Row Level Security is enabled on all four tables (the schema does this)
- [ ] `.env.local` is never committed (`.gitignore` covers it)

---

## Troubleshooting

**Listings show but admin won't sign in** — `SESSION_SECRET` or `BOOTSTRAP_HASH` missing. Add them and redeploy; env vars only apply to new builds.

**"Database not configured"** — `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` missing or wrong. Check for a trailing space when pasting.

**Listings appear but nothing saves** — you're seeing the bundled fallback (`data/listings.json`). Vercel's filesystem is read-only, so writes need Supabase.

**Webhook returns 503** — `WA_APP_SECRET` isn't set. By design.

**Domain shows the old site** — DNS still cached. Check with `dig www.highproperties.in`, and make sure Cloudflare's proxy is grey, not orange.

**Check the logs** — Vercel → Deployments → click a deployment → **Functions**. Every error is logged with a `[highproperties]` prefix.

---

## Running locally

```bash
npm install
cp .env.example .env.local     # fill in the values
npm run dev                    # http://127.0.0.1:3000
npm test                       # smoke-test the API
```

## Free tier limits

| | Free allowance | This site |
|---|---|---|
| Vercel bandwidth | 100 GB/month | ~0.5 MB per visit → ~200,000 visits |
| Vercel functions | 100k calls/month | one per page load |
| Supabase storage | 500 MB | a few MB |
| Supabase rows | unlimited | thousands of leads is nothing |

You will not approach these. The one thing to watch: **Supabase pauses a free project after 7 days with no activity** — a single visit wakes it, but if the site goes quiet for a week the first load afterwards is slow. Any uptime pinger (UptimeRobot, free) hitting it daily prevents that.
