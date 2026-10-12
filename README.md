# Payroll Dashboard

A dashboard that helps a project manager understand weekly construction payroll at a glance and spot rows that look like data-entry errors. Built with Vite, React and TypeScript, entirely client-side.

## Quick start

Requires Node 20.19+ or 22.12+.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (Vitest)
npm run build    # type-check + production build
```

The dashboard loads `public/payroll_data.csv`. Use **Upload CSV** in the header to analyze another file with the same columns; **Download CSV** gets the source file, so the "line N" references in flagged entries can be looked up.

## What's on the dashboard

The page follows a project manager's questions in order: *what did we spend?*, *is anything wrong?*, *who should I look into?*

1. **Summary:** total labor cost and entries to review first, then headcount, weeks covered, total hours, overtime and apprentice share of hours, and average standard, overtime and benefits rates (hover for the typical employee's rate).
2. **Entries to review:** every flagged row, most severe first, filterable by severity. Each row lists its issues and, for pay-rate problems, the cost impact (+$2,897). Click a row for the full explanation, for example *"Standard rate $88.57 is 131% above Kamille O'Reilly's typical $38.34"*, plus the matching context (that week's hours by day for hours problems, its rates for pay problems) and the CSV line. A "How entries are flagged" panel lists every rule and threshold.
3. **Employees:** a sortable table, opening with the most-flagged employees first. It shows the min, average and max hours per day worked and each rate (standard, overtime, benefits).

## How anomalies are defined

I profiled the data before writing any rules, and set each threshold from the real distributions. All thresholds live in [`src/lib/thresholds.ts`](src/lib/thresholds.ts).

| Rule | Flags when | Severity | Rows |
|---|---|---|---|
| Unusual pay rate | Standard rate is more than 20% from the employee's **median** rate | high | 6 |
| Very long week | More than 60 hours | high | 4 |
| Very long day | More than 16 hours in one day | high | 4 |
| Over 8 ST hours in a day | The extra hours should probably have been overtime | medium | 8 |
| Apprentice above journeyworker | Apprentice is paid more than the typical journeyworker in the same trade | medium | 2 |
| Name mismatch | The name differs from the one usually used for that ID. Medium for a spelling difference; high if the first name differs (possibly a different person) | medium / high | 3 |

**Safety-net checks** that find nothing in this file, but protect future uploads:
- duplicate weeks
- overtime rate below the standard rate
- overtime with no standard hours
- very short weeks (under 8 hours) and very short days (a day worked for under 2 hours)
- one name used under several IDs
- a week ending that isn't a Saturday
- invalid values (these rows are excluded from all totals)

**Result: 17 flagged rows,** each one matching something found by hand while profiling:
- 6 weeks where the pay rates jumped or dropped
- 4 weeks of 85+ hours
- 4 days of about 20 hours
- 3 name problems: 2 typos, plus a different first name under one ID

The unusual pay rates alone cost about **$7,432 more and $2,786 less** than the same hours at each employee's usual rates.

**Deliberately not flagged:** weekend work, weeks with more than 40 standard hours, and missing weeks. All three are common in this data, so they look like normal patterns on this project rather than errors.

## Key decisions

- **Median, not mean, for "typical" rates.** One spike week would drag a mean toward itself and partly hide the spike.
- **Bad rows are excluded and reported, never patched.** Totals include flagged-but-valid rows, with the flagged count shown beside them.
- **Hours are rounded when parsed; money only when displayed.** Adding decimals in JavaScript drifts (`40.89999999999999`), which could flip a "> 60 hours" check.
- **All calculations are pure functions** in `src/lib/`; the React components only display results. Real-data tests check that each rule flags the exact rows found during profiling, and the stats are checked against totals computed independently.
- **Minimal dependencies:** PapaParse and Vitest only. No backend, because 263 rows don't need one.

Full reasoning and known limitations: **[DECISIONS.md](DECISIONS.md)**. Questions I'd ask the client (daily vs weekly overtime, mid-project raises, apprentice ratios…): **[QUESTIONS.md](QUESTIONS.md)**.

## What I'd do next

- **A "this week" view.** The project manager checks payroll weekly before it goes out, so default to the latest week instead of the whole project.
- **"This week vs usual" table for pay-rate entries:** standard, overtime and benefits rates side by side with the employee's usual rates and the cost difference.
- **Pattern hints across employees:** both Painters' rates dropped about 47% in the same week (04/19/2025), which points to one batch-entry error rather than two.
- **A "mark as reviewed" state and comments** on entries, persisted with a small backend, plus history across uploads.
- **A rate baseline that handles approved mid-project raises,** and a check that overtime is about 1.5× the standard rate.
- **Clearer upload errors:** one "missing column" message instead of an error on every row.
- **Employee drill-down, charts** (weekly labor cost, hours by trade), **a phone layout** for the entries table, and **deployment** as a static site.
- **Why the overtime and benefits columns stay in the employee table:** they mostly mirror the standard rate (overtime is always 1.5×), but the brief asks for min/avg/max of all three. With more time I'd collapse them behind a toggle.
