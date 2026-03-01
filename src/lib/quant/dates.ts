function parseIsoDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function yearsBefore(date: string, years: number): string {
  const d = parseIsoDate(date);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return formatIsoDate(d);
}

export function indexOnOrBefore(dates: string[], target: string): number {
  let low = 0;
  let high = dates.length - 1;
  let best = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (dates[mid] <= target) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

export function indexOnOrAfter(dates: string[], target: string): number {
  let low = 0;
  let high = dates.length - 1;
  let best = dates.length;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (dates[mid] >= target) {
      best = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return best === dates.length ? -1 : best;
}

export function monthlyRebalanceIndices(
  dates: string[],
  startIdx: number,
  endIdx: number
): number[] {
  const out: number[] = [];
  let lastMonth = "";

  for (let i = startIdx; i <= endIdx; i += 1) {
    const month = dates[i].slice(0, 7);
    const nextMonth = i < endIdx ? dates[i + 1].slice(0, 7) : "";
    if (month !== lastMonth && nextMonth !== month) {
      out.push(i);
      lastMonth = month;
      continue;
    }
    if (nextMonth !== month) {
      out.push(i);
      lastMonth = month;
    }
  }

  if (out.length === 0 && startIdx <= endIdx) {
    out.push(endIdx);
  }

  return Array.from(new Set(out)).sort((a, b) => a - b);
}

export function weeklyRebalanceIndices(
  dates: string[],
  startIdx: number,
  endIdx: number
): number[] {
  const out: number[] = [];
  let currentWeek = "";

  for (let i = startIdx; i <= endIdx; i += 1) {
    const dt = parseIsoDate(dates[i]);
    const year = dt.getUTCFullYear();
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const dayOfYear =
      Math.floor((dt.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const week = `${year}-W${Math.floor(dayOfYear / 7)}`;

    if (currentWeek && week !== currentWeek) {
      out.push(i - 1);
    }
    currentWeek = week;
  }

  if (endIdx >= startIdx) {
    out.push(endIdx);
  }

  return Array.from(new Set(out.filter((x) => x >= startIdx))).sort((a, b) => a - b);
}

export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}
