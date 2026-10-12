# Questions for the project manager / client

Open questions that would change how the dashboard calculates or flags things. Updated as the work progresses.

## Pay rates
- How much week-to-week variation in an employee's pay rate is normal? (Currently anything more than 20% from their usual rate is flagged.)
- Do rates legitimately change during a project, for example raises, apprentice step-ups, or prevailing-wage updates? If so, is there a list of approved effective dates?
- Is overtime always 1.5× the standard rate? (It is in every row.) Are any hours paid at double time, such as Sundays or holidays?
- Do benefits apply to overtime hours as well as standard hours? (The dashboard currently assumes yes.)
- Does the dashboard need to match payroll to the cent? If so, how is pay rounded: per day, per week, or per pay line?

## Hours and overtime
- Is overtime counted per day (over 8 hours) or per week (over 40 hours)? The data looks like daily overtime, because weeks over 40 standard hours are common.
- Is a 7-day week of around 85 hours ever legitimate, for example during a deadline push or a shutdown?
- Are 12-hour standard days with 7–8 hours of overtime on top a known data-entry pattern (for example hours keyed into the wrong column)?
- What counts as suspiciously low hours for a week or a day?

## Apprentices
- What apprentice-to-journeyworker ratios apply on this project, and do they apply per trade?
- How are apprentice rates set: as a percentage of the journeyworker rate, by step or year?

## Identity and records
- Is `employee_id` the source of truth when the name doesn't match?
- Is "Deanna Wisozk" (ID 1021, week ending 05/03/2025) a different person entered under Zander Wisozk's ID?
- Are missing weeks expected (time off, crew rotation), or could some timesheets be missing?

## Using the dashboard
- Should flagged rows be excluded from the payroll totals, or shown as-is? (They are currently included.)
- Who acts on flagged rows, and what do they need: export, mark as reviewed, add a comment?
- Will new payroll files arrive regularly, and should the dashboard keep history across uploads?
