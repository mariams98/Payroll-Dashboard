# Payroll Dashboard

A dashboard that helps a project manager understand weekly construction payroll at a glance and spot rows that look like data-entry errors. Built with Vite, React and TypeScript, entirely client-side.

## Quick start

Requires Node 20.19+ or 22.12+.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 53 unit tests
npm run build    # type-check + production build
```

## What's on the dashboard

1. **Summary:** headcount, weeks covered, total hours, overtime and apprentice share of hours, total labor cost, typical rates, and how many rows are flagged.
2. **Employees:** a sortable table showing the min, average and max hours per day worked and each rate (standard, overtime, benefits), plus how many weeks were flagged.
3. **Anomalies:** every flagged row, most severe first, with each reason in plain English. For example: *"Standard rate $88.57 is 131% above Kamille O'Reilly's typical $38.34"*.

## How anomalies are defined

I profiled the data before writing any rules, and set each threshold from the real distributions. All thresholds live in [`src/lib/thresholds.ts`](src/lib/thresholds.ts).

| Rule | Flags when | Severity | Rows |
|---|---|---|---|
| Unusual pay rate | Standard rate is more than 20% from the employee's **median** rate | high | 6 |
| Very long week | More than 60 hours | high | 4 |
| Very long day | More than 16 hours in one day | high | 4 |
| Over 8 ST hours in a day | The extra hours should probably have been overtime | medium | 8 |
| Apprentice above journeyworker | Apprentice is paid more than the typical journeyworker in the same trade | medium | 2 |
| Name mismatch | The name differs from the one usually used for that ID | medium | 3 |

**Safety-net checks** that find nothing in this file, but protect future uploads:
- duplicate weeks
- overtime rate below the standard rate
- overtime with no standard hours
- very short weeks
- one name used under several IDs
- a week ending that isn't a Saturday
- invalid values (these rows are excluded from all totals)

**Result: 17 flagged rows,** each one matching something found by hand while profiling:
- 6 weeks where the pay rates jumped or dropped
- 4 weeks of 85+ hours
- 4 days of about 20 hours
- 3 name problems

**Deliberately not flagged:** weekend work, weeks with more than 40 standard hours, and missing weeks. All three are common in this data, so they look like normal patterns on this project rather than errors.

## Key decisions

- **Median, not mean, for "typical" rates.** One spike week would drag a mean toward itself and partly hide the spike.
- **Bad rows are excluded and reported, never patched.** Totals include flagged-but-valid rows, with the flagged count shown beside them.
- **Hours are rounded when parsed; money only when displayed.** Adding decimals in JavaScript drifts (`40.89999999999999`), which could flip a "> 60 hours" check.
- **All calculations are pure functions** in `src/lib/`; the React components only display results. Real-data tests check that each rule flags the exact rows found during profiling, and the stats are checked against totals computed independently.
- **Minimal dependencies:** PapaParse and Vitest only. No backend, because 263 rows don't need one.

Full reasoning and known limitations: **[DECISIONS.md](DECISIONS.md)**. Questions I'd ask the client (daily vs weekly overtime, mid-project raises, apprentice ratios…): **[QUESTIONS.md](QUESTIONS.md)**.

## What I'd do next

- **Employee drill-down:** week-by-week hours, rates and pay, with flagged weeks highlighted.
- **Filters on the anomaly table** by severity and rule, plus a "mark as reviewed" state.
- **CSV upload.** `parseCsv(text)` already accepts any text.
- **Charts:** weekly labor cost over time, and hours by trade.
- **A rate baseline that handles legitimate mid-project raises,** then deploy as a static site.
