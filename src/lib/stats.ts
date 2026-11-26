/** Fill gaps so charts show every day (short ranges) or every month (all time). */
export function bucketSeries(series: { day: string; count: number }[], days: number, now = new Date()) {
  if (days > 0) {
    const out: { label: string; count: number }[] = [];
    const map = new Map(series.map((s) => [s.day, s.count]));
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ label: d.toLocaleDateString('el-GR', { day: 'numeric', month: 'short' }), count: map.get(key) ?? 0 });
    }
    return out;
  }
  const months = new Map<string, number>();
  for (const s of series) months.set(s.day.slice(0, 7), (months.get(s.day.slice(0, 7)) ?? 0) + s.count);
  return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([m, count]) => ({ label: new Date(`${m}-01`).toLocaleDateString('el-GR', { month: 'short', year: '2-digit' }), count }));
}
