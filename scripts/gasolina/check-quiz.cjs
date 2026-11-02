const assert = require('node:assert/strict');
const { gasolineResult, isGasolinaAnswers, WEB_GUIDE, FOCUS_NAMES, OBJECTIVES, WEEK_PATTERNS, BLOCKERS } = require('../../src/lib/gasolina/quiz.ts');
const base = { trainingTime: 'morning', sessionType: 'hard', mainProblem: 'pre', objective:'energy',weekPattern:'lowFuel',blocker:'knowledge' };
const tests = [
  [{ ...base, mainProblem: 'pre' }, 'preworkout'],
  [{ ...base, mainProblem: 'carbs', weekPattern:'samePlate', objective:'marks' }, 'carbs'],
  [{ ...base, mainProblem: 'recovery',weekPattern:'lateHunger',sessionType:'double' }, 'recovery'],
  [{ ...base, mainProblem: 'week', weekPattern:'unplanned', objective:'flexible',blocker:'time' }, 'structure'],
  [{ ...base, mainProblem: 'lowEnergy',weekPattern:'lowFuel' }, 'preworkout'],
  [{ ...base, mainProblem: 'afterHunger',weekPattern:'lateHunger' }, 'recovery'],
];
for(const [input,focus] of tests){
  assert.equal(isGasolinaAnswers(input),true);
  const result=gasolineResult(input);
  assert.equal(result.focus,focus);
  assert.equal(result.actions.length,3);
  assert.ok(result.example.length>20);
  assert.ok(result.ambition.length>20);
  assert.ok(FOCUS_NAMES[focus]);
}
for(const field of ['trainingTime','sessionType','mainProblem','objective','weekPattern','blocker']){
  assert.equal(isGasolinaAnswers({ ...base, [field]:'invalid'}),false);
  assert.equal(isGasolinaAnswers({ ...base, [field]:undefined}),false);
}
assert.equal(WEB_GUIDE.length,4);
assert.equal(OBJECTIVES.length,4);
assert.equal(WEEK_PATTERNS.length,4);
assert.equal(BLOCKERS.length,4);
console.log('GASOLINA v2: six answers, all four focus types and extended web guide validated.');
