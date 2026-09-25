import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

const D = (value) => new Decimal(value ?? 0);
const asString = (value, places = 2) => D(value).toDecimalPlaces(places).toFixed(places);

export function calculateOperation(input, settings) {
  const contracts = D(input.mesaContracts);
  const realLots = D(input.realLots);
  const takeTicks = D(input.takeTicks);
  const stopTicks = D(input.stopTicks);
  const tickValue = D(settings.mnqTickValue);
  const tickSize = D(settings.mnqTickSize);
  const realPointValue = D(settings.ustecValuePerPoint);

  return {
    mesaTake: asString(takeTicks.times(contracts).times(tickValue)),
    mesaStop: asString(stopTicks.times(contracts).times(tickValue).negated()),
    realTake: asString(takeTicks.times(tickSize).times(realLots).times(realPointValue).negated()),
    realStop: asString(stopTicks.times(tickSize).times(realLots).times(realPointValue)),
  };
}

export function adjustmentBalance(target, realized) {
  return asString(D(target).minus(D(realized)));
}

const signed = (magnitude, balance) => D(magnitude).times(D(balance).isNegative() ? -1 : 1);

export function roundToLotStep(value, step, mode = 'nearest') {
  const ratio = D(value).div(step);
  const rounding = mode === 'down' ? Decimal.ROUND_FLOOR : mode === 'up' ? Decimal.ROUND_CEIL : Decimal.ROUND_HALF_UP;
  return ratio.toDecimalPlaces(0, rounding).times(step);
}

export function proportionalTickTargets(targetField, targetTicks, referenceTakeTicks, referenceStopTicks) {
  const ticks = D(targetTicks);
  const takeReference = D(referenceTakeTicks);
  const stopReference = D(referenceStopTicks);
  if (ticks.lessThanOrEqualTo(0) || takeReference.lessThanOrEqualTo(0) || stopReference.lessThanOrEqualTo(0)) {
    throw new Error('Ticks de referência devem ser positivos.');
  }
  if (String(targetField).toLowerCase().includes('take')) {
    return {
      takeTicks: ticks.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
      stopTicks: Decimal.max(1, ticks.times(stopReference).div(takeReference).toDecimalPlaces(0, Decimal.ROUND_HALF_UP)).toNumber(),
    };
  }
  return {
    takeTicks: Decimal.max(1, ticks.times(takeReference).div(stopReference).toDecimalPlaces(0, Decimal.ROUND_HALF_UP)).toNumber(),
    stopTicks: ticks.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
  };
}

function makeMesaCandidate(contracts, balance, tickValue) {
  if (contracts < 1) return null;
  const exactTicks = D(balance).abs().div(D(contracts).times(tickValue));
  const ticks = exactTicks.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  if (ticks < 1) return null;
  const result = signed(D(ticks).times(contracts).times(tickValue), balance);
  return {
    quantity: String(contracts), ticks, result: asString(result),
    difference: asString(result.minus(balance)), score: result.minus(balance).abs().toNumber(),
  };
}

function makeRealCandidate(lots, ticks, balance, settings) {
  const result = signed(D(ticks).times(settings.mnqTickSize).times(lots).times(settings.ustecValuePerPoint), balance);
  return {
    quantity: D(lots).toFixed(decimalPlaces(settings.lotStep)), ticks,
    result: asString(result), difference: asString(result.minus(balance)),
    score: result.minus(balance).abs().toNumber(),
  };
}

function decimalPlaces(step) {
  const text = String(step);
  return text.includes('.') ? text.replace(/0+$/, '').split('.')[1]?.length || 0 : 0;
}

export function calculateAdjustment({ market, target, realized, mode, ticks, quantity }, settings) {
  const balance = D(target).minus(realized);
  if (balance.isZero()) return { balance: '0.00', direction: 'NEUTRA', suggestions: [] };
  const suggestions = [];

  if (market === 'mesa') {
    const tickValue = D(settings.mnqTickValue);
    if (mode === 'keep_ticks') {
      const exact = balance.abs().div(D(ticks).times(tickValue));
      const floor = Math.max(1, exact.floor().toNumber());
      const ceil = Math.max(1, exact.ceil().toNumber());
      new Set([floor, ceil]).forEach((contracts) => suggestions.push(makeMesaCandidate(contracts, balance, tickValue)));
    } else if (mode === 'keep_quantity') {
      const exactTicks = balance.abs().div(D(quantity).times(tickValue));
      const low = Math.max(1, exactTicks.floor().toNumber());
      const high = Math.max(1, exactTicks.ceil().toNumber());
      for (const t of new Set([low, high])) {
        const result = signed(D(t).times(quantity).times(tickValue), balance);
        suggestions.push({ quantity: String(Math.trunc(quantity)), ticks: t, result: asString(result), difference: asString(result.minus(balance)), score: result.minus(balance).abs().toNumber() });
      }
    } else {
      const reference = Math.max(1, Math.round(Number(quantity || 8)));
      for (let contracts = Math.max(1, reference - 5); contracts <= reference + 8; contracts++) suggestions.push(makeMesaCandidate(contracts, balance, tickValue));
    }
  } else {
    const unit = D(settings.mnqTickSize).times(settings.ustecValuePerPoint);
    const step = D(settings.lotStep);
    const minLot = D(settings.minLot);
    const maxLot = D(settings.maxLot);
    if (mode === 'keep_ticks') {
      const exact = balance.abs().div(D(ticks).times(unit));
      for (const lot of [roundToLotStep(exact, step, 'down'), roundToLotStep(exact, step, 'up')]) {
        if (lot.greaterThanOrEqualTo(minLot) && lot.lessThanOrEqualTo(maxLot)) suggestions.push(makeRealCandidate(lot, Number(ticks), balance, settings));
      }
    } else if (mode === 'keep_quantity') {
      const validLot = roundToLotStep(quantity, step);
      const exactTicks = balance.abs().div(validLot.times(unit));
      for (const t of new Set([Math.max(1, exactTicks.floor().toNumber()), Math.max(1, exactTicks.ceil().toNumber())])) suggestions.push(makeRealCandidate(validLot, t, balance, settings));
    } else {
      const refTicks = Math.max(1, Number(ticks || 150));
      const exactLot = balance.abs().div(D(refTicks).times(unit));
      for (let offset = -5; offset <= 5; offset++) {
        const lot = roundToLotStep(exactLot.plus(step.times(offset)), step);
        if (lot.lessThan(minLot) || lot.greaterThan(maxLot)) continue;
        const exactTicks = balance.abs().div(lot.times(unit));
        suggestions.push(makeRealCandidate(lot, Math.max(1, exactTicks.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()), balance, settings));
      }
    }
  }

  const unique = [...new Map(suggestions.filter(Boolean).map((item) => [`${item.quantity}-${item.ticks}`, item])).values()]
    .sort((a, b) => a.score - b.score || a.ticks - b.ticks)
    .slice(0, 12)
    .map(({ score, ...item }) => ({ ...item, accumulated: asString(D(realized).plus(item.result)) }));

  return { balance: asString(balance), direction: balance.isNegative() ? 'NEGATIVA' : 'POSITIVA', suggestions: unique };
}

export function enrichAdjustmentSuggestions(result, input, settings) {
  if (!input.targetField || !input.referenceTakeTicks || !input.referenceStopTicks || input.mesaContracts === undefined || input.realLots === undefined) return result;
  const baselineSigns = { mesaTake: 1, mesaStop: -1, realTake: -1, realStop: 1 };
  const neededSign = D(result.balance).isNegative() ? -1 : 1;
  const flip = neededSign === baselineSigns[input.targetField] ? 1 : -1;
  return {
    ...result,
    suggestions: result.suggestions.map((suggestion) => {
      const { takeTicks, stopTicks } = proportionalTickTargets(
        input.targetField, suggestion.ticks, input.referenceTakeTicks, input.referenceStopTicks,
      );
      const mesaContracts = input.market === 'mesa' ? suggestion.quantity : String(input.mesaContracts);
      const realLots = input.market === 'real' ? suggestion.quantity : String(input.realLots);
      const baseImpact = calculateOperation({ mesaContracts, realLots, takeTicks, stopTicks }, settings);
      const impact = Object.fromEntries(Object.entries(baseImpact).map(([key, value]) => [key, asString(D(value).times(flip))]));
      return { ...suggestion, takeTicks, stopTicks, mesaContracts, realLots, impact };
    }),
  };
}

export function combinedImpact(input, settings) {
  const impact = calculateOperation(input, settings);
  const before = input.before || { mesaTake: 0, mesaStop: 0, realTake: 0, realStop: 0 };
  const after = Object.fromEntries(Object.keys(impact).map((key) => [key, asString(D(before[key] || 0).plus(impact[key]))]));
  return { impact, before, after };
}
