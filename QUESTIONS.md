# Questions for the client

Ordered by how much the answer would change the dashboard.

## Highest impact
- Is this file what was actually paid, or timesheets before payroll runs? Determines whether a flag is money lost or a fix still possible.
- Do you review payroll weekly before it goes out? If so, the default view should be the latest week, not the whole project.
- Is OT triggered daily (> 8 h) or weekly (> 40 h)? The data suggests daily.
- Do rates change mid-project (raises, apprentice step-ups, prevailing-wage updates)? A list of approved changes would remove false positives from the rate rule.
- Which flags should block payroll vs. just need a note? You should own the severity definitions.

## Pay
- What week-to-week rate variance is normal? We flag > 20%.
- Is OT always 1.5×? Any double time (Sundays, holidays)?
- Do benefits apply to OT hours? We assume yes.
- Does this need to reconcile to the cent? If so, at what level is pay rounded?
- Two Painters' rates dropped ~47% in the same week (04/19/2025). Known change, or a batch-entry error?

## Hours
- Is an 85-hour, 7-day week ever legitimate (shutdowns, deadline pushes)?
- Are 12 h ST + 8 h OT days a known entry pattern, e.g. hours keyed into the wrong column?

## People and records
- Is `employee_id` the source of truth when names disagree? Is "Deanna Wisozk" (ID 1021, 05/03/2025) a different person?
- Are missing weeks expected, or could timesheets be missing?
- What apprentice-to-journeyworker ratio rules apply, and per trade?

## Workflow
- Who fixes flagged rows, and what do they need: CSV line numbers, export, mark-as-reviewed, comments?
- Will new files arrive regularly, and should history persist across uploads?
