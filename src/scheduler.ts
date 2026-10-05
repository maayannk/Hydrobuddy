/**
 * Pure reminder scheduler. Has no dependency on the `vscode` module so it can be
 * unit-tested with a fake clock.
 *
 * A single low-frequency ticker checks a wall-clock deadline instead of relying on
 * one long setTimeout. This survives laptop sleep / long event-loop stalls and lets
 * the status bar countdown share the same tick.
 */

export type SchedulerState = 'stopped' | 'running' | 'due';

export interface Clock {
  now(): number;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (handle) => clearInterval(handle as NodeJS.Timeout),
};

export interface SchedulerCallbacks {
  /** Fired once when the deadline is reached. */
  onDue: () => void;
  /** Fired on every tick (for countdown UIs). */
  onTick?: () => void;
  /** Fired if a callback throws; the scheduler keeps running. */
  onError?: (err: unknown) => void;
}

export class ReminderScheduler {
  private state: SchedulerState = 'stopped';
  private nextAt: number | undefined;
  private handle: unknown;

  constructor(
    private intervalMs: number,
    private readonly callbacks: SchedulerCallbacks,
    private readonly clock: Clock = systemClock,
    private readonly tickMs = 1000,
  ) {
    if (!(intervalMs > 0)) {
      throw new RangeError('intervalMs must be a positive number');
    }
  }

  getState(): SchedulerState {
    return this.state;
  }

  getIntervalMs(): number {
    return this.intervalMs;
  }

  /** Timestamp of the next reminder, or undefined when stopped / already due. */
  getNextAt(): number | undefined {
    return this.state === 'running' ? this.nextAt : undefined;
  }

  /** Milliseconds until the next reminder (never negative), or undefined. */
  getRemainingMs(): number | undefined {
    const next = this.getNextAt();
    return next === undefined ? undefined : Math.max(0, next - this.clock.now());
  }

  /** Start (or restart) a full interval from now. */
  start(): void {
    this.scheduleIn(this.intervalMs);
  }

  /** Alias for start(); used after the user acknowledges a reminder. */
  restart(): void {
    this.start();
  }

  /** Postpone the reminder by the given number of milliseconds. */
  snooze(ms: number): void {
    if (!(ms > 0)) {
      throw new RangeError('snooze ms must be a positive number');
    }
    this.scheduleIn(ms);
  }

  /** Change the interval. If running, the countdown restarts with the new interval. */
  setIntervalMs(ms: number): void {
    if (!(ms > 0)) {
      throw new RangeError('intervalMs must be a positive number');
    }
    this.intervalMs = ms;
    if (this.state === 'running') {
      this.start();
    }
  }

  /** Fire the reminder immediately, regardless of the current countdown. */
  triggerNow(): void {
    this.ensureTicking();
    this.becomeDue();
  }

  stop(): void {
    this.state = 'stopped';
    this.nextAt = undefined;
    if (this.handle !== undefined) {
      this.clock.clearInterval(this.handle);
      this.handle = undefined;
    }
  }

  dispose(): void {
    this.stop();
  }

  /** Advance the scheduler. Called by the internal ticker; public for tests. */
  tick(): void {
    if (this.state === 'running' && this.nextAt !== undefined && this.clock.now() >= this.nextAt) {
      this.becomeDue();
    }
    this.safely(this.callbacks.onTick);
  }

  private scheduleIn(ms: number): void {
    this.nextAt = this.clock.now() + ms;
    this.state = 'running';
    this.ensureTicking();
  }

  private becomeDue(): void {
    this.state = 'due';
    this.nextAt = undefined;
    this.safely(this.callbacks.onDue);
  }

  private ensureTicking(): void {
    if (this.handle === undefined) {
      this.handle = this.clock.setInterval(() => this.tick(), this.tickMs);
    }
  }

  private safely(fn: (() => void) | undefined): void {
    if (!fn) {
      return;
    }
    try {
      fn();
    } catch (err) {
      this.callbacks.onError?.(err);
    }
  }
}
