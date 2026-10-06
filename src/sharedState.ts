/**
 * Reminder state shared by every VS Code window. Each window runs its own copy of
 * the extension, so the schedule, the "reminder is due" flag, which window shows
 * the mascot, and the daily stats all live in one file that every window reads.
 *
 * Everything here is pure (no `vscode`, no I/O) so it can be unit-tested.
 * Transitions return the same object when nothing changes, so callers can skip writes.
 */
import { HydrationStats, normalizeStats, recordDrink, resetToday } from './stats';

export interface SharedState {
  /** Incremented on every write. */
  rev: number;
  /** When the next reminder fires; null while due or stopped. */
  nextAt: number | null;
  /** When the current reminder became due; null when none is waiting. */
  dueAt: number | null;
  /** Window id that is showing the current reminder. */
  owner: string | null;
  /** Interval the current countdown was started with. */
  intervalMs: number | null;
  /** The window the user used most recently. */
  lastFocused: { id: string; at: number } | null;
  /** The most recent answer to a reminder, so other windows can say what happened. */
  lastAck: { at: number; kind: Ack; by: string; dueAt: number | null } | null;
  /** Window id -> last heartbeat, to show how many windows are in sync. */
  windows: Record<string, number>;
  /** Chosen buddy (mascot id or "random"); null means use the setting. */
  mascot: string | null;
  /** Highest sync protocol any window has written; older windows ask to be reloaded. */
  protocol: number;
  stats: HydrationStats;
}

/** Bump when the shared-state format or rules change in a way older windows can't follow. */
export const PROTOCOL = 2;
/** Windows heartbeat this often... */
export const HEARTBEAT_MS = 10_000;
/** ...and count as gone after this long without one. */
export const WINDOW_TIMEOUT_MS = 35_000;

export type Status = 'stopped' | 'running' | 'due';
export type Ack = 'drank' | 'snooze' | 'dismiss';

/** A countdown overdue by more than this at startup means no window was open; start fresh. */
export const STALE_NEXT_MS = 5 * 60_000;
/** A reminder left unanswered for longer than this is dropped at startup. */
export const STALE_DUE_MS = 3 * 60 * 60_000;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function initialState(now: number): SharedState {
  return {
    rev: 0,
    nextAt: null,
    dueAt: null,
    owner: null,
    intervalMs: null,
    lastFocused: null,
    lastAck: null,
    windows: {},
    mascot: null,
    protocol: PROTOCOL,
    stats: normalizeStats(undefined, new Date(now)),
  };
}

/** Validate untrusted file contents. */
export function parseState(raw: unknown, now: number): SharedState {
  if (!raw || typeof raw !== 'object') {
    return initialState(now);
  }
  const r = raw as Record<string, unknown>;
  const lf = r.lastFocused as { id?: unknown; at?: unknown } | null | undefined;
  const lfAt = num(lf?.at);
  const la = r.lastAck as { at?: unknown; kind?: unknown; by?: unknown; dueAt?: unknown } | null | undefined;
  const laAt = num(la?.at);
  const windows: Record<string, number> = {};
  if (r.windows && typeof r.windows === 'object') {
    for (const [id, seen] of Object.entries(r.windows as Record<string, unknown>)) {
      const t = num(seen);
      if (t !== null && now - t < WINDOW_TIMEOUT_MS) {
        windows[id] = t;
      }
    }
  }
  return {
    rev: num(r.rev) ?? 0,
    nextAt: num(r.nextAt),
    dueAt: num(r.dueAt),
    owner: typeof r.owner === 'string' ? r.owner : null,
    intervalMs: num(r.intervalMs),
    lastFocused: lf && typeof lf.id === 'string' && lfAt !== null ? { id: lf.id, at: lfAt } : null,
    lastAck:
      la && laAt !== null && typeof la.by === 'string' && (la.kind === 'drank' || la.kind === 'snooze' || la.kind === 'dismiss')
        ? { at: laAt, kind: la.kind, by: la.by, dueAt: num(la.dueAt) }
        : null,
    windows,
    mascot: typeof r.mascot === 'string' && r.mascot.length < 40 ? r.mascot : null,
    protocol: num(r.protocol) ?? 1,
    stats: normalizeStats(r.stats, new Date(now)),
  };
}

export function statusOf(s: SharedState): Status {
  return s.dueAt !== null ? 'due' : s.nextAt !== null ? 'running' : 'stopped';
}

/**
 * Make sure a countdown is running with `intervalMs`. Safe to call from every
 * window: once one window has applied it, the others see no change.
 */
export function ensureRunning(s: SharedState, now: number, intervalMs: number, atStartup = false): SharedState {
  if (s.dueAt !== null) {
    if (atStartup && now - s.dueAt > STALE_DUE_MS) {
      return { ...s, dueAt: null, owner: null, nextAt: now + intervalMs, intervalMs };
    }
    return s.intervalMs === intervalMs ? s : { ...s, intervalMs };
  }
  if (s.nextAt === null || s.intervalMs !== intervalMs || (atStartup && now - s.nextAt > STALE_NEXT_MS)) {
    return { ...s, nextAt: now + intervalMs, intervalMs };
  }
  return s;
}

export function stopped(s: SharedState): SharedState {
  return s.nextAt === null && s.dueAt === null && s.owner === null ? s : { ...s, nextAt: null, dueAt: null, owner: null };
}

/** Flip to "due" once the deadline passes. Only the first window to do so wins. */
export function markDueIfReached(s: SharedState, now: number, owner: string): SharedState {
  if (s.dueAt !== null || s.nextAt === null || now < s.nextAt) {
    return s;
  }
  return { ...s, nextAt: null, dueAt: now, owner };
}

/** Show the reminder now, in window `owner`. */
export function triggerNow(s: SharedState, now: number, owner: string): SharedState {
  return { ...s, nextAt: null, dueAt: s.dueAt ?? now, owner };
}

/** Move the waiting reminder to window `id`. */
export function claim(s: SharedState, id: string): SharedState {
  return s.dueAt === null || s.owner === id ? s : { ...s, owner: id };
}

/** Give up the reminder (e.g. the window is closing) so another window can take it. */
export function release(s: SharedState, id: string): SharedState {
  if (s.owner !== id && !(id in s.windows)) {
    return s;
  }
  const windows = { ...s.windows };
  delete windows[id];
  return { ...s, owner: s.owner === id ? null : s.owner, windows };
}

/** Record that window `id` is alive and which protocol it speaks. */
export function heartbeat(s: SharedState, id: string, now: number): SharedState {
  return { ...s, windows: { ...s.windows, [id]: now }, protocol: Math.max(s.protocol, PROTOCOL) };
}

export function activeWindowCount(s: SharedState, now: number): number {
  return Object.values(s.windows).filter((t) => now - t < WINDOW_TIMEOUT_MS).length;
}

export function focused(s: SharedState, id: string, now: number): SharedState {
  return { ...s, lastFocused: { id, at: now } };
}

export interface AckOptions {
  /** Window that answered. */
  by: string;
  intervalMs: number;
  snoozeMs: number;
  enabled: boolean;
  /**
   * The dueAt the reminder UI was shown for. If the reminder has already been
   * handled in another window, the action is ignored (prevents double counting).
   */
  expectDueAt?: number | null;
}

export function acknowledge(s: SharedState, ack: Ack, now: number, o: AckOptions): SharedState {
  if (o.expectDueAt !== undefined && s.dueAt !== o.expectDueAt) {
    return s;
  }
  if (ack === 'dismiss' && s.dueAt === null) {
    return s;
  }
  const stats = ack === 'drank' ? recordDrink(s.stats, new Date(now)) : s.stats;
  const lastAck = { at: now, kind: ack, by: o.by, dueAt: s.dueAt };
  if (!o.enabled) {
    return { ...s, stats, lastAck, nextAt: null, dueAt: null, owner: null };
  }
  // The next reminder is always counted from the moment it was answered, for every window.
  const delay = ack === 'snooze' ? o.snoozeMs : o.intervalMs;
  return { ...s, stats, lastAck, dueAt: null, owner: null, nextAt: now + delay, intervalMs: o.intervalMs };
}

/** Remember the chosen buddy for every window. */
export function chooseMascot(s: SharedState, id: string): SharedState {
  return s.mascot === id ? s : { ...s, mascot: id };
}

export function resetTodayState(s: SharedState, now: number): SharedState {
  return { ...s, stats: resetToday(s.stats, new Date(now)) };
}
