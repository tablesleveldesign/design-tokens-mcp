function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = (previous[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min((previous[j] as number) + 1, (current[j - 1] as number) + 1, substitution);
    }
    previous = current;
  }
  return previous[b.length] as number;
}

/**
 * Candidates nearest to `query`. Names containing the query come first, because a fragment like `teal.700` or `accent`
 * is a stronger signal than a low edit distance. Ties break alphabetically, so the order is stable.
 */
export function closestNames(query: string, candidates: string[], limit = 3): string[] {
  const needle = query.toLowerCase();
  return candidates
    .map((name) => {
      const lower = name.toLowerCase();
      return { name, contains: lower.includes(needle), distance: editDistance(needle, lower) };
    })
    .sort(
      (a, b) =>
        Number(b.contains) - Number(a.contains) || a.distance - b.distance || a.name.localeCompare(b.name, 'en'),
    )
    .slice(0, limit)
    .map((candidate) => candidate.name);
}
