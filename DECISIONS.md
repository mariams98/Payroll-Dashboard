# Decisions

## Architecture
- Client-side only (Vite + React + TS). 263 rows parse instantly in the browser; a backend adds nothing until we need persistence or history across uploads.
- All logic lives in pure functions in `src/lib/`. Components only render. This keeps the rules unit-testable and lets upload reuse the exact same pipeline.
- Dependencies: PapaParse (quoting/line-ending edge cases aren't worth hand-rolling) and Vitest. No table or UI library.
- `dynamicTyping` is off so our own parser can report non-numeric values instead of silently passing strings through.

## Data handling
- Invalid rows (blank, non-numeric, negative, bad date, unknown level) are excluded from totals and reported. Patching them with defaults would hide errors in the totals.
- A real date that isn't a Saturday is kept and flagged medium: the numbers are usable, only the label is off.
- Dates are parsed by hand and checked to round-trip; `new Date()` turns 02/30 into Mar 2.
- Hours are rounded to 2 dp at parse time. Float drift (`40.89999999999999`) affected 82/263 weekly totals and could flip `> 60` checks. Money is never rounded until display.
- Identity is keyed on `employee_id`; the most frequent name per ID is canonical.
- Benefits = all hours × benefits rate. Assumption; see QUESTIONS.md.

## Thresholds
Set from the data's distributions, not intuition. All in `thresholds.ts`.
- Rate deviation > 20% from the employee's median. Real deviations are 0% or ≥ 46%, so anything from 10–40% flags the same 6 rows.
- Day > 16 h (p99 of worked days is 12.8 h). Week > 60 h (p95 is 48.8 h, then a jump to 85+).
- ST > 8 in a day is flagged; ST > 40 in a week is not. ~40 normal weeks exceed 40 ST while daily ST never exceeds 8, which points to daily OT.
- Low-hours rules (day < 2 h, week < 8 h) find nothing here. They exist for future files.
- Not flagged: weekend work (~100 rows) and missing weeks (most employees skip 1–7). Both are normal on this project.

## Baselines
- Each employee's usual rate is the median of their weekly rates, so one spike can't hide itself by dragging the mean.
- Employees with < 3 weeks are skipped; with two values the median can't tell which is wrong.
- Summary averages are hours-weighted (pay ÷ hours), so they match what was actually paid. The median "typical employee" rate is in the card tooltip.
- Employee table "Avg" columns are plain means including flagged weeks, as the brief asks for averages. Outliers are visible in min/max and the flagged-weeks column.
- Hours-per-day stats exclude zero-hour days; otherwise every minimum is 0.

## Anomaly reporting
- One function per rule. Each rule flags a row at most once; day-level rules list all affected days in one message.
- Severity: high = money affected or physically implausible; medium = likely entry error; low = could be legitimate.
- Name mismatch with a different first name is high (possibly a different person); a spelling difference is medium. Crude heuristic: misses first-name typos and nicknames.
- Pay-rate flags carry a cost impact: actual week cost minus the same hours at usual rates. Worded "more/less than usual", not "overpaid", since we don't know if this is pay or timesheets.
- Totals include flagged rows. Excluding them would mean guessing the correct values.

## UI
- Page order follows the PM's questions: what did we spend, what's wrong, who's involved. Summary → entries to review → employees.
- Entries collapse to one line with rule labels so the "why" is visible without clicking; expanding shows the full explanation plus only the relevant context (day grid for hours issues, rates for pay issues).
- Rule explanations are generated from the threshold constants, so the in-app panel can't drift from the code.
- Click-to-open panels instead of hover tooltips for anything substantial: hover doesn't exist on touch screens.
- Clickable cards get a chevron and shadow rather than relying on hover.

## Verification
- A standalone Node script (no app code) reproduced every summary card, all 368 numeric employee-table cells, and every rule's flag count. 0 mismatches.

## Known limitations
- Rate baseline breaks on legitimate mid-project raises (e.g. 8 weeks at $40, 6 at $50 flags all six). Needs approved rate-change dates from the client.
- A file with wrong columns produces an error per row instead of one "missing column" message.
- Row numbers are off by one after blank lines; years < 100 map to 19xx. Neither occurs in this file.
- `level` is typed as `string` rather than a union; IDs sort as text.
- The parse + detect + group merge lives in `App.tsx`; an `analyze(text)` function in `src/lib` would make it testable.
