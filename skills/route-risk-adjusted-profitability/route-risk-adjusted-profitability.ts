#!/usr/bin/env bun

type Snapshot = Record<string, unknown>;
type Payload = {
  input?: { route?: string };
  state?: {
    routeProfitabilityByRoute?: Record<string, Snapshot>;
    routeRiskByRoute?: Record<string, Snapshot>;
  };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function run(payload: Payload) {
  if (!isObject(payload) || !isObject(payload.input) || !isObject(payload.state)) {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  const route = typeof payload.input.route === "string" ? payload.input.route.trim() : "";
  if (!route) {
    return { ok: false, error: "MISSING_ROUTE" };
  }

  const profitabilityByRoute = payload.state.routeProfitabilityByRoute;
  const riskByRoute = payload.state.routeRiskByRoute;

  if (!isObject(profitabilityByRoute) || !isObject(riskByRoute)) {
    return { ok: false, error: "INVALID_STATE" };
  }

  const profitabilitySnapshot = profitabilityByRoute[route];
  const riskSnapshot = riskByRoute[route];

  if (!isObject(profitabilitySnapshot)) {
    return { ok: false, error: "MISSING_PROFITABILITY_SNAPSHOT" };
  }

  if (!isObject(riskSnapshot)) {
    return { ok: false, error: "MISSING_RISK_SNAPSHOT" };
  }

  const pnl = profitabilitySnapshot.pnl;
  const accountingUnit = profitabilitySnapshot.accountingUnit;
  const riskScore = riskSnapshot.riskScore;

  if (typeof pnl !== "number" || !Number.isFinite(pnl)) {
    return { ok: false, error: "INVALID_PNL" };
  }

  if (typeof accountingUnit !== "string" || accountingUnit.trim() === "") {
    return { ok: false, error: "INVALID_ACCOUNTING_UNIT" };
  }

  if (typeof riskScore !== "number" || !Number.isFinite(riskScore) || riskScore < 0 || riskScore > 1) {
    return { ok: false, error: "INVALID_RISK_SCORE" };
  }

  const adjustedPnl = pnl * (1 - riskScore);

  return {
    ok: true,
    stateUpdates: {
      routeRiskAdjustedProfitabilityByRoute: {
        [route]: {
          adjustedPnl,
          accountingUnit: accountingUnit.trim(),
          riskScore,
        },
      },
    },
  };
}

async function main() {
  const raw = await new Response(Bun.stdin).text();
  const trimmed = raw.trim();

  if (!trimmed) {
    process.stdout.write(JSON.stringify({ ok: false, error: "MISSING_INPUT" }));
    process.exit(1);
  }

  try {
    const result = run(JSON.parse(trimmed));
    process.stdout.write(JSON.stringify(result));
    if (!result.ok) {
      process.exit(1);
    }
  } catch {
    process.stdout.write(JSON.stringify({ ok: false, error: "INVALID_JSON_INPUT" }));
    process.exit(1);
  }
}

main();
