// Hours in the file have one decimal, but adding floats drifts (7.3 + 6.6 + ... = 40.89999999999999).
// Rounding to 2 decimals keeps totals exact so threshold comparisons like "> 60" are reliable.
export function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100
}

// Middle value of a list (average of the two middle values for an even count).
// Unlike the mean, one extreme value barely moves it.
export function median(values: number[]): number {
  if (values.length === 0) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

// Put items into buckets by key, keeping the original order inside each bucket.
export function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = getKey(item)
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }
  return groups
}
