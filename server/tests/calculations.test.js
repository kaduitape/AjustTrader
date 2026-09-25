import test from 'node:test';
import assert from 'node:assert/strict';
import { adjustmentBalance, calculateAdjustment, calculateOperation, enrichAdjustmentSuggestions, proportionalTickTargets, roundToLotStep } from '../src/calculations.js';

const settings = {
  mnqTickSize: '0.25', mnqTickValue: '0.50', ustecValuePerPoint: '1.00',
  lotStep: '0.01', minLot: '0.01', maxLot: '100.00',
};

test('calcula os quatro resultados da operação original', () => {
  assert.deepEqual(calculateOperation({ mesaContracts: 20, realLots: '4', takeTicks: 150, stopTicks: 200 }, settings), {
    mesaTake: '1500.00', mesaStop: '-2000.00', realTake: '-150.00', realStop: '200.00',
  });
});

test('saldo: meta +1500 e realizado +890 resulta +610', () => assert.equal(adjustmentBalance('1500', '890'), '610.00'));
test('saldo: meta -150 e realizado +100 resulta -250', () => assert.equal(adjustmentBalance('-150', '100'), '-250.00'));
test('saldo: meta -150 e realizado -70 resulta -80', () => assert.equal(adjustmentBalance('-150', '-70'), '-80.00'));
test('saldo: meta -150 e realizado -220 resulta +70', () => assert.equal(adjustmentBalance('-150', '-220'), '70.00'));

test('sugestão MNQ respeita contratos e ticks inteiros', () => {
  const result = calculateAdjustment({ market: 'mesa', target: '1500', realized: '890', mode: 'keep_ticks', ticks: 150 }, settings);
  assert.equal(result.balance, '610.00');
  assert.ok(result.suggestions.every((item) => Number.isInteger(Number(item.quantity)) && Number.isInteger(item.ticks)));
  assert.deepEqual(result.suggestions.find((item) => item.quantity === '8'), { quantity: '8', ticks: 153, result: '612.00', difference: '2.00', accumulated: '1502.00' });
});

test('sugestão Real respeita step de 0.01 e sinal algébrico', () => {
  const result = calculateAdjustment({ market: 'real', target: '-150', realized: '100', mode: 'keep_ticks', ticks: 150 }, settings);
  assert.equal(result.balance, '-250.00');
  assert.equal(result.direction, 'NEGATIVA');
  assert.equal(result.suggestions[0].quantity, '6.67');
  assert.equal(result.suggestions[0].result, '-250.13');
  assert.equal(result.suggestions[0].accumulated, '-150.13');
});

test('roundToLotStep nunca gera lote fora do step', () => {
  assert.equal(roundToLotStep('6.6667', '0.01').toFixed(2), '6.67');
  assert.equal(roundToLotStep('6.6667', '0.1').toFixed(1), '6.7');
});

test('calcula stop inteiro mantendo a proporção original', () => {
  assert.deepEqual(proportionalTickTargets('mesaTake', 62, 154, 200), { takeTicks: 62, stopTicks: 81 });
  assert.deepEqual(proportionalTickTargets('mesaStop', 81, 154, 200), { takeTicks: 62, stopTicks: 81 });
});

test('projeta os quatro impactos da configuração de ajuste', () => {
  const input = {
    market: 'mesa', target: '1540', realized: '920', mode: 'keep_quantity', quantity: 20,
    targetField: 'mesaTake', referenceTakeTicks: 154, referenceStopTicks: 200,
    mesaContracts: 20, realLots: '4.15',
  };
  const result = enrichAdjustmentSuggestions(calculateAdjustment(input, settings), input, settings);
  assert.deepEqual(result.suggestions[0], {
    quantity: '20', ticks: 62, result: '620.00', difference: '0.00', accumulated: '1540.00',
    takeTicks: 62, stopTicks: 81, mesaContracts: '20', realLots: '4.15',
    impact: { mesaTake: '620.00', mesaStop: '-810.00', realTake: '-64.33', realStop: '84.04' },
  });
});
