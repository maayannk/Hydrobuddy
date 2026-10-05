import * as assert from 'assert';
import { dayKey, formatCountdown, lastNDays, normalizeStats, recordDrink, resetToday } from '../../stats';

suite('stats', () => {
  const mon = new Date(2026, 9, 5, 10, 0, 0); // local time
  const tue = new Date(2026, 9, 6, 9, 0, 0);

  test('dayKey uses local date', () => {
    assert.strictEqual(dayKey(new Date(2026, 0, 2, 23, 59)), '2026-01-02');
  });

  test('normalizeStats handles garbage input', () => {
    for (const raw of [undefined, null, 42, 'x', { count: -3, date: 'nope', history: { bad: 1 } }]) {
      const s = normalizeStats(raw, mon);
      assert.strictEqual(s.date, '2026-10-05');
      assert.strictEqual(s.count, 0);
      assert.deepStrictEqual(s.history, {});
    }
  });

  test('recordDrink increments and stamps time', () => {
    let s = normalizeStats(undefined, mon);
    s = recordDrink(s, mon);
    s = recordDrink(s, mon);
    assert.strictEqual(s.count, 2);
    assert.strictEqual(s.lastDrankAt, mon.getTime());
  });

  test('rolls over to a new day and keeps history', () => {
    let s = recordDrink(recordDrink(normalizeStats(undefined, mon), mon), mon);
    s = normalizeStats(s, tue);
    assert.strictEqual(s.date, '2026-10-06');
    assert.strictEqual(s.count, 0);
    assert.strictEqual(s.history['2026-10-05'], 2);
    s = recordDrink(s, tue);
    assert.strictEqual(s.count, 1);
  });

  test('prunes history older than 30 days', () => {
    const s = normalizeStats({ date: '2026-10-05', count: 1, history: { '2026-01-01': 5, '2026-10-01': 3 } }, mon);
    assert.deepStrictEqual(s.history, { '2026-10-01': 3 });
  });

  test('resetToday clears only today', () => {
    let s = normalizeStats({ date: '2026-10-05', count: 4, history: { '2026-10-04': 6 } }, mon);
    s = resetToday(s, mon);
    assert.strictEqual(s.count, 0);
    assert.strictEqual(s.history['2026-10-04'], 6);
  });

  test('lastNDays returns oldest-first including today', () => {
    const s = normalizeStats({ date: '2026-10-05', count: 4, history: { '2026-10-04': 6, '2026-10-01': 2 } }, mon);
    const days = lastNDays(s, mon, 7);
    assert.strictEqual(days.length, 7);
    assert.deepStrictEqual(days[0], { date: '2026-09-29', count: 0 });
    assert.deepStrictEqual(days[2], { date: '2026-10-01', count: 2 });
    assert.deepStrictEqual(days[5], { date: '2026-10-04', count: 6 });
    assert.deepStrictEqual(days[6], { date: '2026-10-05', count: 4 });
  });

  test('formatCountdown', () => {
    assert.strictEqual(formatCountdown(45 * 60_000), '45:00');
    assert.strictEqual(formatCountdown(65_000), '1:05');
    assert.strictEqual(formatCountdown(3_723_000), '1:02:03');
    assert.strictEqual(formatCountdown(-5), '0:00');
    assert.strictEqual(formatCountdown(500), '0:01');
  });
});
