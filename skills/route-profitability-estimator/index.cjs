'use strict';

const fs = require('fs');
const path = require('path');

const SKILL_NAME = 'route-profitability-estimator';
const SCHEMA_VERSION = '1.1.0';
const MAX_BPS = 10000;
const BPS_DENOMINATOR = 10000n;
const ISO_UTC_MILLIS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const DEFAULT_COST_BASIS = 'amountIn';

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function fail(error, details) {
  return {
    ok: false,
    skill: SKILL_NAME,
    schemaVersion: SCHEMA_VERSION,
    error,
    details: details || undefined
  };
}

function requireSafeInteger(value, field, options = {}) {
  const minimum = options.minimum ?? 0;

  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(field);
  }

  return value;
}

function requireBps(value, field) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_BPS) {
    throw new Error(field);
  }

  return value;
}

function ceilDiv(numerator, denominator) {
  return (numerator + denominator - 1n) / denominator;
}

function requireSafeBigInt(value, field) {
  if (value > MAX_SAFE_BIGINT || value < -MAX_SAFE_BIGINT) {
    throw new Error(field);
  }
}

function toNumber(value, field) {
  requireSafeBigInt(value, field);

  const numberValue = Number(value);

  if (!Number.isSafeInteger(numberValue)) {
    throw new Error(field);
  }

  return numberValue;
}

function requireUtcTimestamp(value) {
  if (!isNonEmptyString(value) || !ISO_UTC_MILLIS_PATTERN.test(value)) {
    throw new Error('MISSING_OR_INVALID_NOW');
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error('MISSING_OR_INVALID_NOW');
  }

  return value;
}

function buildStateSnapshot({
  route,
  accountingUnit,
  amountIn,
  expectedOut,
  costBasis,
  feeBps,
  slippageBps,
  fee,
  slippage,
  totalCosts,
  netOut,
  pnl,
  status,
  profitable,
  eligible,
  evaluatedAt
}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    route,
    accountingUnit,
    amountIn,
    expectedOut,
    costBasis,
    feeBps,
    slippageBps,
    fee,
    slippage,
    totalCosts,
    netOut,
    pnl,
    status,
    profitable,
    eligible,
    evaluatedAt
  };
}

function buildUnknownResult({ route, now }) {
  const decision = {
    route,
    status: 'UNKNOWN',
    profitable: null,
    eligible: false,
    reason: 'MISSING_ROUTE_QUOTE',
    evaluatedAt: now
  };

  return {
    ok: true,
    skill: SKILL_NAME,
    schemaVersion: SCHEMA_VERSION,
    decision,
    metrics: {
      costBasis: DEFAULT_COST_BASIS
    },
    stateUpdates: {
      routeProfitabilityByRoute: {
        [route]: {
          schemaVersion: SCHEMA_VERSION,
          route,
          status: 'UNKNOWN',
          profitable: null,
          eligible: false,
          evaluatedAt: now
        }
      }
    },
    auditEntry: {
      skill: SKILL_NAME,
      schemaVersion: SCHEMA_VERSION,
      route,
      status: 'UNKNOWN',
      reason: 'MISSING_ROUTE_QUOTE',
      profitable: null,
      eligible: false,
      evaluatedAt: now
    }
  };
}

function parsePayload(payload) {
  if (!isObject(payload)) {
    throw new Error('INVALID_PAYLOAD');
  }

  if (!isObject(payload.input)) {
    throw new Error('INVALID_INPUT_WRAPPER');
  }

  if (!isObject(payload.state)) {
    throw new Error('INVALID_STATE');
  }

  const route = payload.input.route;
  const amountIn = payload.input.amountIn;

  if (!isNonEmptyString(route)) {
    throw new Error('MISSING_ROUTE');
  }

  return {
    route: route.trim(),
    amountIn: requireSafeInteger(amountIn, 'INVALID_AMOUNT_IN', { minimum: 1 }),
    state: payload.state,
    now: requireUtcTimestamp(payload.now)
  };
}

function readQuote(state, route) {
  const marketQuotesByRoute = state.marketQuotesByRoute;

  if (!isObject(marketQuotesByRoute)) {
    throw new Error('INVALID_MARKET_QUOTES_STATE');
  }

  if (!(route in marketQuotesByRoute)) {
    return null;
  }

  const quote = marketQuotesByRoute[route];

  if (!isObject(quote)) {
    throw new Error('INVALID_ROUTE_QUOTE');
  }

  const accountingUnit = quote.accountingUnit;

  if (!isNonEmptyString(accountingUnit) || accountingUnit.trim().length < 3) {
    throw new Error('INVALID_ACCOUNTING_UNIT');
  }

  return {
    accountingUnit: accountingUnit.trim(),
    expectedOut: requireSafeInteger(quote.expectedOut, 'INVALID_EXPECTED_OUT', { minimum: 0 }),
    feeBps: requireBps(quote.feeBps, 'INVALID_FEE_BPS'),
    slippageBps: requireBps(quote.slippageBps, 'INVALID_SLIPPAGE_BPS')
  };
}

function classifyResult(netOut, amountIn) {
  if (netOut <= 0) {
    return {
      status: 'UNPROFITABLE',
      profitable: false,
      eligible: false,
      reason: 'NET_OUT_NOT_POSITIVE'
    };
  }

  if (netOut < amountIn) {
    return {
      status: 'UNPROFITABLE_AFTER_COSTS',
      profitable: false,
      eligible: false,
      reason: 'NET_OUT_BELOW_AMOUNT_IN'
    };
  }

  if (netOut === amountIn) {
    return {
      status: 'BREAK_EVEN',
      profitable: false,
      eligible: true,
      reason: 'NET_OUT_EQUALS_AMOUNT_IN'
    };
  }

  return {
    status: 'PROFITABLE',
    profitable: true,
    eligible: true,
    reason: 'NET_OUT_ABOVE_AMOUNT_IN'
  };
}

function run(payload) {
  let normalized;

  try {
    normalized = parsePayload(payload);
  } catch (error) {
    return fail(error.message);
  }

  const { route, amountIn, state, now } = normalized;

  let quote;

  try {
    quote = readQuote(state, route);
  } catch (error) {
    return fail(error.message, { route });
  }

  if (quote === null) {
    return buildUnknownResult({ route, now });
  }

  const costBasis = DEFAULT_COST_BASIS;
  const amountInBig = BigInt(amountIn);
  const expectedOutBig = BigInt(quote.expectedOut);
  const feeBig = ceilDiv(amountInBig * BigInt(quote.feeBps), BPS_DENOMINATOR);
  const slippageBig = ceilDiv(amountInBig * BigInt(quote.slippageBps), BPS_DENOMINATOR);
  const totalCostsBig = feeBig + slippageBig;
  const netOutBig = expectedOutBig - totalCostsBig;
  const pnlBig = netOutBig - amountInBig;

  let fee;
  let slippage;
  let totalCosts;
  let netOut;
  let pnl;

  try {
    fee = toNumber(feeBig, 'UNSAFE_FEE');
    slippage = toNumber(slippageBig, 'UNSAFE_SLIPPAGE');
    totalCosts = toNumber(totalCostsBig, 'UNSAFE_TOTAL_COSTS');
    netOut = toNumber(netOutBig, 'UNSAFE_NET_OUT');
    pnl = toNumber(pnlBig, 'UNSAFE_PNL');
  } catch (error) {
    return fail(error.message, { route });
  }

  const classification = classifyResult(netOut, amountIn);

  const metrics = {
    costBasis,
    accountingUnit: quote.accountingUnit,
    amountIn,
    expectedOut: quote.expectedOut,
    feeBps: quote.feeBps,
    slippageBps: quote.slippageBps,
    fee,
    slippage,
    totalCosts,
    netOut,
    pnl
  };

  const decision = {
    route,
    status: classification.status,
    profitable: classification.profitable,
    eligible: classification.eligible,
    reason: classification.reason,
    evaluatedAt: now
  };

  return {
    ok: true,
    skill: SKILL_NAME,
    schemaVersion: SCHEMA_VERSION,
    decision,
    metrics,
    stateUpdates: {
      routeProfitabilityByRoute: {
        [route]: buildStateSnapshot({
          route,
          accountingUnit: quote.accountingUnit,
          amountIn,
          expectedOut: quote.expectedOut,
          costBasis,
          feeBps: quote.feeBps,
          slippageBps: quote.slippageBps,
          fee,
          slippage,
          totalCosts,
          netOut,
          pnl,
          status: classification.status,
          profitable: classification.profitable,
          eligible: classification.eligible,
          evaluatedAt: now
        })
      }
    },
    auditEntry: {
      skill: SKILL_NAME,
      schemaVersion: SCHEMA_VERSION,
      route,
      status: classification.status,
      reason: classification.reason,
      profitable: classification.profitable,
      eligible: classification.eligible,
      pnl,
      netOut,
      accountingUnit: quote.accountingUnit,
      costBasis,
      evaluatedAt: now
    }
  };
}

function readPayloadFromCli() {
  const inputPath = process.argv[2];

  if (inputPath) {
    return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), inputPath), 'utf8'));
  }

  const stdin = fs.readFileSync(0, 'utf8').trim();

  if (!stdin) {
    throw new Error('MISSING_INPUT');
  }

  return JSON.parse(stdin);
}

if (require.main === module) {
  try {
    const payload = readPayloadFromCli();
    const result = run(payload);
    const output = JSON.stringify(result, null, 2);

    if (!result.ok) {
      console.error(output);
      process.exit(1);
    }

    process.stdout.write(output + '\n');
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      skill: SKILL_NAME,
      schemaVersion: SCHEMA_VERSION,
      error: error.message === 'MISSING_INPUT' ? error.message : 'INVALID_JSON_INPUT'
    }, null, 2));
    process.exit(1);
  }
}

module.exports = {
  run
};
