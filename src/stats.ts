/**
 * Pure helpers for daily hydration statistics. No `vscode` dependency.
 */

export interface HydrationStats {
  /** Local date (YYYY-MM-DD) that `count` belongs to. */
  date: string;
  /** Water breaks logged on `date`. */
  count: number;
  /** Epoch ms of the most recent logged drink. */
  lastDrankAt?: number;
  /** Counts for previous days, keyed by YYYY-MM-DD. */
  history: Record<string, number>;
}

export const HISTORY_DAYS = 30;

/** Local-time YYYY-MM-DD key for a date. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function emptyStats(now: Date): HydrationStats {
  return { date: dayKey(now), count: 0, history: {} };
}

/** Validate untrusted stored data and roll it over to `now`'s date if needed. */
export function normalizeStats(raw: unknown, now: Date): HydrationStats {
  const today = dayKey(now);
  if (!raw || typeof raw !== 'object') {
    return emptyStats(now);
  }
  const r = raw as Partial<HydrationStats>;
  const history: Record<string, number> = {};
  if (r.history && typeof r.history === 'object') {
    for (const [k, v] of Object.entries(r.history)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Number.isFinite(v) && v >= 0) {
        history[k] = Math.floor(v);
      }
    }
  }
  let date = typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : today;
  let count = Number.isFinite(r.count) && (r.count as number) >= 0 ? Math.floor(r.count as number) : 0;
  const lastDrankAt = Number.isFinite(r.lastDrankAt) ? r.lastDrankAt : undefined;

  if (date !== today) {
    if (count > 0) {
      history[date] = count;
    }
    date = today;
    count = 0;
  }

  const cutoff = dayKey(addDays(now, -HISTORY_DAYS));
  for (const k of Object.keys(history)) {
    if (k < cutoff || k >= today) {
      delete history[k];
    }
  }

  return { date, count, lastDrankAt, history };
}

export function recordDrink(stats: HydrationStats, now: Date): HydrationStats {
  const s = normalizeStats(stats, now);
  return { ...s, count: s.count + 1, lastDrankAt: now.getTime() };
}

export function resetToday(stats: HydrationStats, now: Date): HydrationStats {
  const s = normalizeStats(stats, now);
  return { ...s, count: 0, lastDrankAt: undefined };
}

/** The last `n` days (oldest first), including today. */
export function lastNDays(stats: HydrationStats, now: Date, n: number): Array<{ date: string; count: number }> {
  const s = normalizeStats(stats, now);
  const out: Array<{ date: string; count: number }> = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = dayKey(addDays(now, -i));
    out.push({ date: key, count: key === s.date ? s.count : s.history[key] ?? 0 });
  }
  return out;
}

/** "45:00", "4:05", or "1:02:03" style countdown. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * Consecutive days (ending today) on which the goal was met. Today only counts
 * once the goal is reached, but an unfinished today doesn't break the streak.
 */
export function goalStreak(stats: HydrationStats, now: Date, goal: number): number {
  const days = lastNDays(stats, now, HISTORY_DAYS + 1);
  let i = days.length - 1;
  let streak = 0;
  if (days[i].count < goal) {
    i--;
  }
  for (; i >= 0 && days[i].count >= goal; i--) {
    streak++;
  }
  return streak;
}
