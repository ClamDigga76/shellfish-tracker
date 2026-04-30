# BANK-THE-CATCH-YTD-PAID-STRATEGY.md

## Purpose

This file captures the agreed free/paid Year-to-Date strategy for Bank the Catch.

Use it when working on Home, Trips, Insights, YTD, Season Preview, paid gating, free-tier value, KPIs, filters, charts, or section positioning.

This is a project-specific strategy helper. It does not replace `AGENTS.md` or generic Vibe Coder rules.

---

## Core Direction

Full Year-to-Date intelligence should be the first major paid-tier value.

Free users should still get enough value to trust the app and feel that their season is being tracked.

The main rule is:

**Trips = your records. Home = season preview. Insights = full season intelligence.**

Users should never feel locked out of their own trip history.

They are paying for the app to understand the season, not to access their own records.

---

## Section Strategy

### Trips Section

Trips should stay card-based and logbook-focused.

Free users should be able to:

- view trip cards
- search trips
- filter trips
- sort trips
- review saved records
- edit saved records
- use Trips as their personal logbook

Trips should not become an analytics page.

Avoid in Trips:

- YTD totals
- dealer rankings
- area strength summaries
- monthly breakdowns
- trend charts
- “Trip YTD” wording

Best framing:

**Trips = find and review your records.**

---

### Home Section

Home should show a **Season Preview**, not full YTD intelligence.

Free Home can show:

- recent/home KPIs
- last saved trip
- Season Snapshot Preview
- a limited YTD-feel chart
- CTA to unlock Full Insights

Home should give the user the feeling:

**“My season is being tracked.”**

But it should not fully answer:

**“Exactly how did my season perform?”**

---

### Insights Section

Insights is the renamed Reports section.

Use **Insights** as the app-wide name for the former Reports section unless newer project/repo truth overrides it.

Insights should own the paid value.

Paid Insights unlocks:

- exact YTD totals
- full charts
- dealer trends
- area strength
- species breakdowns
- monthly breakdowns
- high-value drivers
- records
- exports/share tools later

Best framing:

**Insights = understand your season.**

---

## Free vs Paid Rule

Free should help users feel organized and confident.

Paid should help users understand performance, patterns, and business intelligence.

Free users should get:

- records
- trip history
- basic review tools
- a season preview
- trust that the app is tracking their work

Paid users should get:

- full YTD intelligence
- deeper trends
- comparisons
- performance drivers
- stronger business insights

---

## Guardrails

Do not make Trips feel locked.

Do not hide a user’s own trip cards behind paid access.

Do not put full YTD analytics inside Trips.

Do not let Home fully replace paid Insights.

Do not use “Trip YTD” wording.

Do not overuse lock icons in records/logbook areas.

Use softer preview language on Home.

Use stronger unlock language for Insights.

---

## Preferred Wording

Use:

- Season Preview
- Season Snapshot Preview
- Full Insights
- Unlock Full Insights
- Season Intelligence
- Dealer Trends
- Area Strength
- Season Trend
- Full YTD
- Full YTD Insights

Avoid:

- Trip YTD
- Reports, unless referencing the old section name or repo truth has not yet renamed it
- locked trip history
- locked records
- full YTD inside Trips

---

## Analytics Logic Reminder

For Bank the Catch analytics and wording:

- price per pound is a dealer/buyer-set pay rate
- total paid is derived from pounds × price per pound
- area strength should be judged primarily by pounds
- dollar amount is secondary for area strength
- dealer comparisons should focus on pay rate competition
- pounds-first thinking matters for harvesting performance

This logic is most relevant to Insights, analytics, comparison, chart, and paid-tier work.

## Decision Lock Ledger Entries

When this overlay is installed, these Bank the Catch decisions may be copied into `DECISION-LOCK-LEDGER.md` or treated as project-specific locked decisions when relevant.

| Decision | Status | Applies To | Why It Matters |
|---|---|---|---|
| Reports section is renamed to Insights | Locked | App-wide naming | Prevents old naming from returning |
| Trips = records/logbook, not analytics | Locked | Trips screen | Keeps trip history free and avoids making Trips feel locked |
| Full YTD intelligence belongs in Insights | Locked | Paid tier / Insights | Keeps paid value clear |
| Free species is Soft Shell Clams only | Locked | Free tier / Trips filters | Prevents accidental free multi-species behavior |
| Home gets Season Preview, not full YTD Reports | Locked | Home screen | Lets free users feel their season without giving away full analytics |
| Users should not feel locked out of their own trip history | Locked | Free/paid strategy | Users pay for season intelligence, not access to their own records |
