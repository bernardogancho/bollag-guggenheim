import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AGENDA = require.resolve('../src/_data/agenda.js');
const CONTENT = require.resolve('../src/_data/cms/agenda.json');

// agenda.js reads the clock when it loads, so each case sets the date first
// and then requires it fresh.
const monthsOn = (iso) => {
  vi.setSystemTime(new Date(`${iso}T12:00:00Z`));
  delete require.cache[AGENDA];
  delete require.cache[CONTENT];
  return require(AGENDA).months;
};

const labels = (months) => months.flatMap((m) => m.events.map((e) => e.dateLabel));

describe('agenda: past appointments drop off by themselves', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete require.cache[AGENDA];
    delete require.cache[CONTENT];
  });

  it('hides a month once every appointment in it has finished', () => {
    vi.useFakeTimers();
    expect(monthsOn('2026-04-01').map((m) => m.month)).toContain('April 2026');
    expect(monthsOn('2026-09-03').map((m) => m.month)).not.toContain('April 2026');
  });

  it('keeps an appointment that runs past the end of its own month', () => {
    vi.useFakeTimers();
    // "26 May - 25 June 2026" is filed under May but is still running on 6 June.
    const may = monthsOn('2026-06-06').find((m) => m.month === 'May 2026');
    expect(may).toBeDefined();
    expect(labels([may])).toContain('26 May - 25 June 2026');
    // ...while a May appointment that ended on 29 May is gone.
    expect(labels([may])).not.toContain('4 - 29 May 2026');
  });

  it('drops an appointment the day after its last day', () => {
    vi.useFakeTimers();
    expect(labels(monthsOn('2026-07-31'))).toContain('20 - 31 July 2026');
    expect(labels(monthsOn('2026-08-01'))).not.toContain('20 - 31 July 2026');
  });

  it('never hides an appointment whose date cannot be read', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T12:00:00Z'));
    delete require.cache[AGENDA];
    delete require.cache[CONTENT];
    const content = require(CONTENT);
    const original = content.months;
    content.months = [{ month: 'Spring 2027', events: [{ dateLabel: 'Dates on request', brand: 'X' }] }];
    delete require.cache[AGENDA];
    try {
      expect(labels(require(AGENDA).months)).toContain('Dates on request');
    } finally {
      content.months = original;
    }
  });

  it('does not hide an appointment whose year is a typo for a future month', () => {
    vi.useFakeTimers();
    // "25 JANUARY - 5 FEBRUARY 2026" sits under January 2027; the year is wrong,
    // but January 2027 is still ahead, so it must stay visible.
    const jan = monthsOn('2026-09-03').find((m) => m.month === 'January 2027');
    expect(labels([jan])).toContain('25 JANUARY - 5 FEBRUARY 2026');
  });

  it('keeps CMS bindings pointing at the real position in the file', () => {
    vi.useFakeTimers();
    const months = monthsOn('2026-09-03');
    const all = require(CONTENT).months;
    for (const month of months) {
      expect(all[month.sourceIndex].month).toBe(month.month);
    }
  });
});
