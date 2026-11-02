const assert = require('node:assert/strict');
const { gasolineResult, isGasolinaAnswers } = require('../../src/lib/gasolina/quiz.ts');
const base = { trainingTime: 'morning', sessionType: 'hard', mainProblem: 'pre' };
for (const [problem, focus] of Object.entries({
  pre: 'preworkout', lowEnergy: 'preworkout', carbs: 'carbs',
  recovery: 'recovery', afterHunger: 'structure', week: 'structure',
})) {
  const input = { ...base, mainProblem: problem };
  assert.equal(isGasolinaAnswers(input), true);
  const result = gasolineResult(input);
  assert.equal(result.focus, focus);
  assert.equal(result.actions.length, 3);
}
assert.equal(isGasolinaAnswers({ ...base, trainingTime: 'invalid' }), false);
assert.equal(isGasolinaAnswers({ ...base, sessionType: undefined }), false);
console.log('GASOLINA: 6 problem classifications and invalid inputs validated.');
