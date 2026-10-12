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

## Invalid rows are excluded, not guessed
- A row with a blank, non-numeric or negative value, an unknown level, or an invalid date is **left out of all calculations** and listed as a high-severity data issue. All of its problems are reported together.
- Filling in zeros or defaults would quietly distort the totals.
- A week ending that is a real date but not a Saturday is **kept** and flagged as medium severity. The numbers are still usable; only the label looks wrong.
- The current file has none of these problems, but the checks protect against future uploads.
- Dates are parsed by hand (MM/DD/YYYY) and checked to round-trip, because `new Date()` silently turns "02/30" into March 2.
- `employee_id` is kept as text. It is an identifier, not a quantity, so no arithmetic is ever done on it.

## Rounding: hours when parsing, money only when displaying
- Adding decimal hours in JavaScript drifts (7.3 + 6.6 + ... gives 40.89999999999999 instead of 40.9). 82 of the 263 weekly totals were affected. Since the anomaly rules compare against thresholds like "> 60 hours", weekly hour totals are rounded to 2 decimals when parsed.
- Money (pay, benefits, cost) is kept unrounded and only formatted to cents when displayed. A real payroll system rounds each line to the cent, so the dashboard's totals may differ from the actual payroll by a few cents. That is acceptable for an overview, but a reconciliation tool would need to round per row (see QUESTIONS.md).

## Thresholds come from the observed data
The data was profiled before choosing any thresholds:
- **Rate deviation.** Every row is either exactly at the employee's usual rate or at least 46% away from it, so any threshold between 10% and 40% flags the same 6 rows. **20%** was chosen.
- **Daily hours.** On worked days the 99th percentile is 12.8 h. The flag is set at **> 16 h**, which is physically implausible for a construction shift.
- **Weekly hours.** The 95th percentile is 48.8 h, and the next values jump to 85–88 h. The flag is set at **> 60 h**.
- All thresholds live in one file (`thresholds.ts`) so they are easy to discuss and tune with the client.

## How anomalies are reported
- Each rule is a separate pure function in `src/lib/anomalies.ts`, and `detectAnomalies` runs them all. A rule can be tested, tuned or removed on its own.
- **A rule flags a row at most once.** Day-level rules (e.g. "standard hours above 8") list every affected day in one message ("Mon 9.4h, Wed 9.5h") instead of one entry per day. A blow-out week would otherwise produce 7 near-identical entries.
- A row can still be flagged by several different rules. The UI groups them by row.
- **Severity** reflects how likely the row is to be wrong and how much it could cost:
  - **high:** money directly affected or physically implausible (rate jumps, OT paid below ST, more than 16 h in a day, more than 60 h in a week, duplicate weeks, unreadable rows)
  - **medium:** probably a data-entry mistake (more than 8 ST in a day, apprentice paid above journeyworkers, OT with no ST, name typos)
- **Name mismatches are split by first name.** The same first name with a different spelling ("Maxine Danch" vs "Maxine Dach") is medium: likely a typo. A different first name under the same ID ("Deanna Wisozk" under Zander Wisozk's ID) is high, because it may mean pay going to a different person. Comparing first names is a simple heuristic: it would miss a typo in the first name and wouldn't catch a nickname ("Alex" vs "Alexander").
- **Pay-rate anomalies show their cost impact** in a separate "Cost impact" column (+$2,897 / −$949), so the amounts can be scanned down one column rather than read out of sentences. It is what the week cost minus what the same hours would cost at the employee's usual (median) standard, overtime and benefits rates.
- **"Over 8 ST hours in a day" is shown smaller when the row has another reason.** In this data it never appears alone; it always accompanies a very long week or day. De-emphasizing it roughly halves the text without hiding anything. The page also totals these (about $7,432 more and $2,786 less on this data), because "how much money is at stake" is the project manager's first question. It is called "cost more/less than usual", not "overpaid", because the file may be timesheets rather than payments made (see QUESTIONS.md).
  - **low:** could be legitimate (very short weeks or days, two people sharing a name)
- **Low-hours rules find nothing in this data, by design.** The shortest worked day is exactly 2.0 hours and the shortest week is 22 hours, so the thresholds (under 2 hours on a day worked, under 8 hours in a week) sit just below what the data shows. They exist because the brief asks for suspiciously low hours, and they would catch typos like 0.5 for 5 in a future file. Days with 0 hours are days off, not anomalies.
- **Identity checks run both ways:** an ID used with several names, and a name used under several IDs. The second is low severity because two employees can share a name.
- An employee whose typical rate is $0 is skipped by the rate-deviation rule, because a percentage change from zero is meaningless.

## Median, not mean, for the "typical" rate
- An employee's baseline rate is the **median** of their weekly rates. A single spike (for example +131%) would drag the mean toward itself and partly hide the spike.
- The dashboard's "Typical employee" rates use the median of the per-employee medians for the same reason. They are shown beside the hours-weighted averages (see "Which 'average' each number uses").
- **Employees with fewer than 3 weeks are skipped** by the rate check. With only $40 and $100, the median is $70 and both weeks would be flagged, including the correct one.
- **Limitation: a legitimate mid-project raise confuses the median.** With 8 weeks at $40 and 6 at $50, the median is $40 and all six $50 weeks get flagged. With 7 and 7, the median is $45 and nothing is flagged. Every employee in this data has one constant rate apart from the spikes, so this doesn't happen here. Handling raises properly needs the client's list of approved rate changes (see QUESTIONS.md), or a baseline based on the previous few weeks instead of the whole project.

## Overtime looks like it is defined per day
- About 40 normal-looking weeks have more than 40 standard hours, yet daily standard hours never exceed 8 on normal days.
- That pattern fits a "more than 8 hours per day" OT rule, not "more than 40 hours per week". So:
  - daily standard hours above 8 **are** flagged
  - weekly standard hours above 40 **are not**
- This is an open question for the client (see QUESTIONS.md).

## Page layout follows the project manager's questions
- The intended user is a non-technical project manager with a few minutes a week. The page answers their questions in order: *what did we spend?* (total labor cost, the largest card), *is anything wrong?* (entries to review, the red card, then the list), and *who should I look into?* (the employee table, sorted by flagged weeks).
- The anomaly list sits above the employee table, so the PM doesn't have to scroll past 23 rows to find problems.
- The table's "Flagged weeks" column sits next to the name, because on a laptop the table is wider than the screen and the last columns are hidden until you scroll.
- **"Entries to review", not "weeks to review".** Each flagged item is one employee's week. "17 weeks" on a 15-week project would read as an error.
- A one-line legend explains what high, medium and low mean in terms of action ("check before payroll goes out").

## Employee table: plain averages, with flags alongside
- The min / avg / max rate columns use the plain mean, as the brief asks for "average". A spike week does pull an employee's average up or down, but that is visible: the min or max column shows the outlier, and the "Flagged weeks" column shows that the employee has flagged weeks.
- The "typical" rates on the summary cards use medians instead, because they describe the whole crew.
- An employee's level and trade are taken from their first row. No one changes level or trade in this data; if an apprentice moved up mid-project, the table would show their starting level.
- The table is a plain HTML table, with sorting done by `useState` plus `Array.sort` and no table library. Every column is a flat field on `EmployeeStats`, so a single comparison function sorts any column.

## Which "average" each number uses
- **Summary "Average standard / overtime / benefits rate"** ($41.59 / $62.72 / $16.20) are weighted by hours: pay ÷ hours (ST pay ÷ ST hours, OT pay ÷ OT hours, benefits ÷ all hours). They are what was actually paid per hour, so a spot-check with a spreadsheet matches. These are the headline numbers because the brief asks for "average wage rates and benefits rates".
- **"Typical employee"** under each average ($43.41 / $65.11 / $16.25) is the median of each employee's median rate. It describes a typical worker and ignores spike weeks.
- The two differ because the typical rate counts each employee once, regardless of how many hours they worked. For comparison, the plain average of all 263 weekly standard rates is $41.68.
- **Employee table "Avg" rate** is the unweighted mean of that employee's weekly rates, **including** flagged weeks.
- **Employee table "Avg" hours per day** is the mean over days actually worked, with each worked day counting equally.

## Numbers verified independently
- A standalone script that reads only the CSV (no app code) reproduced every summary card, all 368 numeric cells of the employee table, and the flagged-row count for every rule, with 0 mismatches.

## Daily-hours stats only count days actually worked
- Most weeks have days with 0 hours (weekends, days off). Including them would make every employee's minimum 0 and pull the average down.
- Min, max and average hours per day are therefore computed over days with more than 0 hours.

## Employee identity is keyed on `employee_id`
- Three IDs appear with more than one name. Two look like typos ("Maxine Danch", "Tyler Reichrt"). One has a different first name ("Deanna Wisozk" under Zander Wisozk's ID).
- The most frequent name for an ID is treated as the canonical name. Every row with a different name is flagged.

## Summary totals include every row
- Payroll totals reflect the data as submitted, including flagged rows. The dashboard shows how many rows are flagged, so the reader knows what might be off.
- **Tradeoff:** excluding flagged rows would mean guessing what the correct values should be.

## Pay formulas, and benefits apply to all hours worked
- Gross pay = ST hours × standard rate + OT hours × overtime rate. Total cost = gross pay + benefits.
- The benefits cost is calculated as (standard hours + overtime hours) × the benefits rate.
- This is an assumption to confirm (see QUESTIONS.md).

## Missing weeks are informational, not anomalies
- Most employees skip 1–7 of the 15 weeks. This is more likely time off or crew rotation than a data error, so gaps are not flagged.

## Weekend work is not flagged
- About 100 rows include Saturday or Sunday hours, so weekend work is a normal pattern on this project.

## Known limitations (found in code review, deliberately not fixed yet)
- **Row numbers after blank lines.** Blank lines are skipped before rows are numbered, so a row after a blank line is reported one line too early. The current file has no blank lines.
- **Years before 100.** `new Date()` maps a year like 0099 to 1999, and the date check doesn't compare the year.
- **Keys must not use `toISOString()`.** Dates are built in local time, so converting them with `toISOString()` can shift them a day in some timezones. Group by `weekEndingRaw` or `getTime()` instead.
- **`level` is typed as plain text,** not `'APPRENTICE' | 'JOURNEYWORKER'`, even though the parser validates it.
- **A file with a wrong or missing column** produces one "is blank" error per row instead of a single "missing column" message. **An empty file** produces no records and no issues.
- **IDs are sorted as text** in the employee table, so "999" would sort after "1000". All IDs here have 4 digits.
- **The table's group-header spans are counted by hand.** They must add up to the number of columns.
- **`stats.ts` imports `canonicalNames` from `anomalies.ts`.** A shared identity helper would avoid the stats module depending on the rules module.
- **The merge of parse issues and rule results lives in `App.tsx`,** not in a tested pure function. An `analyze(csvText)` function in `src/lib` would make it testable and give CSV upload one entry point.
- **In development the CSV is fetched twice,** because React StrictMode runs effects twice in dev. Both fetches set the same state, so nothing breaks.
