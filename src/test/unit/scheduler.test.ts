import * as assert from 'assert';
import { Clock, ReminderScheduler } from '../../scheduler';

class FakeClock implements Clock {
  time = 1_000_000;
  intervals = new Map<number, () => void>();
  private nextId = 1;

  now(): number {
    return this.time;
  }
  setInterval(fn: () => void): unknown {
    const id = this.nextId++;
    this.intervals.set(id, fn);
    return id;
  }
  clearInterval(handle: unknown): void {
    this.intervals.delete(handle as number);
  }
  /** Advance time and fire every active interval once. */
  advance(ms: number): void {
    this.time += ms;
    for (const fn of [...this.intervals.values()]) {
      fn();
    }
  }
}

const MIN = 60_000;

suite('ReminderScheduler', () => {
  let clock: FakeClock;
  let dueCount: number;
  let sched: ReminderScheduler;

  setup(() => {
    clock = new FakeClock();
    dueCount = 0;
    sched = new ReminderScheduler(45 * MIN, { onDue: () => dueCount++ }, clock);
  });

  teardown(() => sched.dispose());

  test('starts stopped and does not tick', () => {
    assert.strictEqual(sched.getState(), 'stopped');
    assert.strictEqual(clock.intervals.size, 0);
    assert.strictEqual(sched.getRemainingMs(), undefined);
  });

  test('fires once when the interval elapses', () => {
    sched.start();
    assert.strictEqual(sched.getRemainingMs(), 45 * MIN);
    clock.advance(44 * MIN);
    assert.strictEqual(dueCount, 0);
    clock.advance(1 * MIN);
    assert.strictEqual(dueCount, 1);
    assert.strictEqual(sched.getState(), 'due');
    clock.advance(60 * MIN);
    assert.strictEqual(dueCount, 1, 'should not fire again until acknowledged');
  });

  test('restart after acknowledgement schedules a fresh interval', () => {
    sched.start();
    clock.advance(45 * MIN);
    sched.restart();
    assert.strictEqual(sched.getState(), 'running');
    assert.strictEqual(sched.getRemainingMs(), 45 * MIN);
    clock.advance(45 * MIN);
    assert.strictEqual(dueCount, 2);
  });

  test('snooze postpones by the snooze duration', () => {
    sched.start();
    clock.advance(45 * MIN);
    sched.snooze(5 * MIN);
    clock.advance(4 * MIN);
    assert.strictEqual(dueCount, 1);
    clock.advance(1 * MIN);
    assert.strictEqual(dueCount, 2);
  });

  test('stop clears the interval timer', () => {
    sched.start();
    assert.strictEqual(clock.intervals.size, 1);
    sched.stop();
    assert.strictEqual(clock.intervals.size, 0);
    assert.strictEqual(sched.getState(), 'stopped');
    clock.advance(100 * MIN);
    assert.strictEqual(dueCount, 0);
  });

  test('only ever creates one interval timer', () => {
    sched.start();
    sched.restart();
    sched.snooze(MIN);
    sched.triggerNow();
    sched.start();
    assert.strictEqual(clock.intervals.size, 1);
  });

  test('changing the interval while running restarts the countdown', () => {
    sched.start();
    clock.advance(30 * MIN);
    sched.setIntervalMs(10 * MIN);
    assert.strictEqual(sched.getRemainingMs(), 10 * MIN);
  });

  test('changing the interval while stopped does not start it', () => {
    sched.setIntervalMs(10 * MIN);
    assert.strictEqual(sched.getState(), 'stopped');
  });

  test('triggerNow fires immediately', () => {
    sched.start();
    sched.triggerNow();
    assert.strictEqual(dueCount, 1);
    assert.strictEqual(sched.getState(), 'due');
  });

  test('catches up after a long sleep', () => {
    sched.start();
    clock.advance(10 * 60 * MIN);
    assert.strictEqual(dueCount, 1);
  });

  test('a throwing callback is reported and does not break the scheduler', () => {
    const errors: unknown[] = [];
    const s = new ReminderScheduler(MIN, { onDue: () => { throw new Error('boom'); }, onError: (e) => errors.push(e) }, clock);
    s.start();
    clock.advance(MIN);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(s.getState(), 'due');
    s.dispose();
  });

  test('rejects invalid intervals', () => {
    assert.throws(() => new ReminderScheduler(0, { onDue: () => undefined }, clock), RangeError);
    assert.throws(() => sched.setIntervalMs(-1), RangeError);
    assert.throws(() => sched.snooze(NaN), RangeError);
  });
});
