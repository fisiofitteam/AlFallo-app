const assert = require('node:assert/strict');
const {
  validYmd, monthSlices, resolveFinanceRange, dayCount, startOfMadridDay, nextYmd,
} = require('../../src/lib/compensation-range.ts');

assert(validYmd('2028-02-29'));
assert(!validYmd('2026-02-29'));
assert(!validYmd('2026-02-30'));
assert(!validYmd('2026-13-01'));
const month = resolveFinanceRange({ from:'2026-10-01', to:'2026-10-31' });
assert.equal(month.fullMonthKey,'2026-10');
assert.equal(month.fromDate.toISOString(),'2026-09-30T22:00:00.000Z');
assert.equal(month.toExclusive.toISOString(),'2026-10-31T23:00:00.000Z');
const cross = resolveFinanceRange({ from:'2026-10-15', to:'2026-11-14' });
assert.equal(cross.fullMonthKey,null);
assert.deepEqual(monthSlices(cross.from,cross.to).map(s=>[s.monthKey,dayCount(s.from,s.to),s.monthDays]),[['2026-10',17,31],['2026-11',14,30]]);
assert.equal(dayCount('2026-02-26','2026-03-02'),5);
assert.equal(nextYmd('2028-02-29'),'2028-03-01');
const spring = startOfMadridDay('2026-03-29');
const springNext = startOfMadridDay('2026-03-30');
const fall = startOfMadridDay('2026-10-25');
const fallNext = startOfMadridDay('2026-10-26');
assert.equal((springNext-spring)/3600000,23);
assert.equal((fallNext-fall)/3600000,25);
const invalid = resolveFinanceRange({from:'2026-02-30',to:'2026-03-02'},new Date('2026-11-09T11:00:00Z'));
assert.equal(invalid.fullMonthKey,'2026-11');
assert.equal(resolveFinanceRange({},new Date('2026-11-09T11:00:00Z')).fullMonthKey,'2026-11');
console.log('Date logic checked: inclusive ranges, cross-month, leap year, Madrid DST and month-only invoicing.');
