'use strict';

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(error) {
  process.stdout.write(JSON.stringify({ ok: false, error }));
  process.exitCode = 1;
}

function readPayload() {
  const chunks = [];

  process.stdin.on('data', (chunk) => {
    chunks.push(chunk);
  });

  process.stdin.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8').trim();

    if (!raw) {
      fail('MISSING_INPUT');
      return;
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      fail('INVALID_JSON_INPUT');
      return;
    }

    if (!isObject(payload) || !isObject(payload.input) || !isObject(payload.state)) {
      fail('INVALID_PAYLOAD');
      return;
    }

    const route = typeof payload.input.route === 'string' ? payload.input.route.trim() : '';
    if (!route) {
      fail('MISSING_ROUTE');
      return;
    }

    const profitabilityByRoute = payload.state.routeProfitabilityByRoute;
    const riskByRoute = payload.state.routeRiskByRoute;

    if (!isObject(profitabilityByRoute) || !isObject(riskByRoute)) {
      fail('INVALID_STATE');
      return;
    }

    const profitabilitySnapshot = profitabilityByRoute[route];
    const riskSnapshot = riskByRoute[route];

    if (!isObject(profitabilitySnapshot)) {
      fail('MISSING_PROFITABILITY_SNAPSHOT');
      return;
    }

    if (!isObject(riskSnapshot)) {
      fail('MISSING_RISK_SNAPSHOT');
      return;
    }

    const pnl = profitabilitySnapshot.pnl;
    const accountingUnit = profitabilitySnapshot.accountingUnit;
    const riskScore = riskSnapshot.riskScore;

    if (typeof pnl !== 'number' || !Number.isFinite(pnl)) {
      fail('INVALID_PNL');
      return;
    }

    if (typeof accountingUnit !== 'string' || accountingUnit.trim() === '') {
      fail('INVALID_ACCOUNTING_UNIT');
      return;
    }

    if (typeof riskScore !== 'number' || !Number.isFinite(riskScore) || riskScore < 0 || riskScore > 1) {
      fail('INVALID_RISK_SCORE');
      return;
    }

    const adjustedPnl = pnl * (1 - riskScore);

    process.stdout.write(JSON.stringify({
      ok: true,
      stateUpdates: {
        routeRiskAdjustedProfitabilityByRoute: {
          [route]: {
            adjustedPnl,
            accountingUnit: accountingUnit.trim(),
            riskScore
          }
        }
      }
    }));
  });
}

readPayload();
