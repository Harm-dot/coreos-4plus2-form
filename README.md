# Core 4+2 Diagnostic — respondent form

A tiny hosted form for the **Core 4+2** Airtable base. A respondent opens a per‑engagement
link, confirms their name from the roster you registered, answers the questions, and their
answers land in your **Responses** table — linked to their Respondent record and each Question.

No build step, no framework. Static `index.html` + two serverless functions.

---

## How it fits your base

- **Engagement** (`Engagements` table) = one client's run. It points to a **Questionnaire** (the
  version) and has **Respondents** (the people, registered up front, each with a role).
- The form reads the engagement's questionnaire → its linked **Questions** (grouped by driver),
  and the engagement's **Respondents** → the "confirm your name" dropdown.
- On submit it writes one **Responses** record per answered question (Answer for *Open text*,
  Self‑rating for *Rating*), linked to the Respondent and the Question. The Engagement is reached
  through the Respondent, so it isn't set directly.

You register engagements and people in Airtable (an interface is set up for this in the base).
The form is respondent‑only.

---

## The link you send

```
https://YOUR-DEPLOYMENT-URL/?e=<engagementRecordId>
```

`<engagementRecordId>` is the Airtable record id of the engagement (starts with `rec`). One link
per engagement; everyone in that engagement uses the same link and picks their own name.

To find an engagement's record id: open the record in Airtable and copy the id from the URL, or
add a formula field `RECORD_ID()` to the `Engagements` table and copy it. (The interface in the
base can show it too.)

---

## Deploy (Vercel)

1. Push this folder to a Git repo (or run `vercel` from inside it).
2. In the Vercel project → **Settings → Environment Variables**, add:
   - `AIRTABLE_TOKEN` — your Airtable Personal Access Token (see below)
   - `AIRTABLE_BASE_ID` — `appfMP8uezWpG5Z2d`
3. Deploy. That's it — `index.html` is served at `/`, and `/api/engagement` + `/api/submit` run
   as functions.

### Netlify

Works the same way; put the functions under `/api` (or set `functions = "api"` in
`netlify.toml`) and add the same two environment variables. Ask if you want a `netlify.toml`.

---

## Create the Airtable token

1. Go to **https://airtable.com/create/tokens**.
2. **Scopes:** `data.records:read` and `data.records:write`.
3. **Access:** add the **Core 4+2** base only.
4. Create it, copy the token (starts with `pat…`), and paste it into `AIRTABLE_TOKEN` in your
   host's environment variables. It never goes in the code or the browser.

---

## Local dev (optional)

```bash
cp .env.example .env      # paste your real token into .env
npx vercel dev            # or: netlify dev
```

Then open `http://localhost:3000/?e=<engagementRecordId>`.

---

## Files

```
index.html          the respondent form (static, self-contained)
api/engagement.js   GET  /api/engagement?e=<id>   → questionnaire + questions + roster
api/submit.js       POST /api/submit              → writes Responses (+ Respondent if "not listed")
lib/airtable.js     shared Airtable helpers + the verified table/field id map
```

All table and field ids in `lib/airtable.js` were verified against the live base. If you rename
a field in Airtable the ids don't change, so nothing breaks; if you rebuild the base from scratch,
update the ids there.
