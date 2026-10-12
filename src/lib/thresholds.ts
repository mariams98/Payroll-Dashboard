// Every anomaly threshold lives here so it is easy to review and tune.
// Values were chosen from the real data's distributions; see DECISIONS.md.

// Flag a week whose standard rate is more than 20% away from the employee's median rate.
export const RATE_DEVIATION_LIMIT = 0.2

// With fewer weeks than this, the median can't tell which rate is the normal one
// (e.g. $40 and $100: the median is $70 and both look wrong), so the rate check is skipped.
export const MIN_WEEKS_FOR_RATE_BASELINE = 3

// Flag a single day with more than 16 total hours (ST + OT).
export const DAILY_HOURS_HIGH = 16

// Standard hours above 8 in one day should probably have been overtime.
export const DAILY_ST_MAX = 8

// Flag a week with more than 60 total hours.
export const WEEKLY_HOURS_HIGH = 60

// Flag a week with fewer than 8 total hours.
export const WEEKLY_HOURS_LOW = 8
