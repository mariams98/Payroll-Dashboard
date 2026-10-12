# Decisions

Tradeoffs made while building this dashboard, and why. Updated as the work progresses.

## Stack: Vite + React + TypeScript, client-side only
- The dataset is small (263 rows), so parsing and computing everything in the browser is instant.
- No server means less code to write, explain and deploy. The built site is static files.
- **Tradeoff:** no persistence or multi-user features. A backend with a database would be the next step if new payroll files arrive regularly.

## Minimal dependencies
- **PapaParse** for CSV parsing. It handles edge cases like quoted fields and line endings that a hand-written `split(',')` would miss.
- **Vitest** for unit tests. It shares Vite's config, so there is no extra setup.
- No table or UI library. A sortable table is a few lines of `useState`, and every line is easy to explain.
- PapaParse's `dynamicTyping` is off. Values are converted with our own number parser, so non-numeric values are reported instead of silently becoming strings.

## All calculations live in pure functions (`src/lib/`)
- The React components only display results. Parsing, stats and anomaly rules are plain functions with no UI dependencies.
- This makes the rules easy to unit test and easy to reuse later (for example on a server or in a CLI).

## Thresholds come from the observed data
The data was profiled before choosing any thresholds:
- **Rate deviation.** Every row is either exactly at the employee's usual rate or at least 46% away from it, so any threshold between 10% and 40% flags the same 6 rows. **20%** was chosen.
- **Daily hours.** On worked days the 99th percentile is 12.8 h. The flag is set at **> 16 h**, which is physically implausible for a construction shift.
- **Weekly hours.** The 95th percentile is 48.8 h, and the next values jump to 85–88 h. The flag is set at **> 60 h**.
- All thresholds live in one file (`thresholds.ts`) so they are easy to discuss and tune with the client.

## Median, not mean, for the "typical" rate
- An employee's baseline rate is the **median** of their weekly rates. A single spike (for example +131%) would drag the mean toward itself and partly hide the spike.
- Dashboard-level average rates use the median of the per-employee medians for the same reason.

## Overtime looks like it is defined per day
- About 40 normal-looking weeks have more than 40 standard hours, yet daily standard hours never exceed 8 on normal days.
- That pattern fits a "more than 8 hours per day" OT rule, not "more than 40 hours per week". So:
  - daily standard hours above 8 **are** flagged
  - weekly standard hours above 40 **are not**
- This is an open question for the client (see QUESTIONS.md).

## Daily-hours stats only count days actually worked
- Most weeks have days with 0 hours (weekends, days off). Including them would make every employee's minimum 0 and pull the average down.
- Min, max and average hours per day are therefore computed over days with more than 0 hours.

## Employee identity is keyed on `employee_id`
- Three IDs appear with more than one name. Two look like typos ("Maxine Danch", "Tyler Reichrt"). One has a different first name ("Deanna Wisozk" under Zander Wisozk's ID).
- The most frequent name for an ID is treated as the canonical name. Every row with a different name is flagged.

## Summary totals include every row
- Payroll totals reflect the data as submitted, including flagged rows. The dashboard shows how many rows are flagged, so the reader knows what might be off.
- **Tradeoff:** excluding flagged rows would mean guessing what the correct values should be.

## Benefits apply to all hours worked
- The benefits cost is calculated as (standard hours + overtime hours) × the benefits rate.
- This is an assumption to confirm (see QUESTIONS.md).

## Missing weeks are informational, not anomalies
- Most employees skip 1–7 of the 15 weeks. This is more likely time off or crew rotation than a data error, so gaps are not flagged.

## Weekend work is not flagged
- About 100 rows include Saturday or Sunday hours, so weekend work is a normal pattern on this project.
