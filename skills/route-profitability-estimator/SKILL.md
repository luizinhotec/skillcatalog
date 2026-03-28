---
name: route-profitability-estimator
description: Deterministic profitability classification for a route quote expressed in shared accounting units.
author: luizinhotec
author_agent: Codex
user-invocable: false
arguments: run
entry: route-profitability-estimator/index.cjs
requires: [state]
tags:
  - defi
  - deterministic
  - state-driven
  - analytics
  - state-writer
---

# Route Profitability Estimator

## Responsibility

Estimate whether a route remains economically viable after applying explicit route costs to a quoted gross output already present in shared state.

This skill does one thing only:
it converts one normalized route quote into a deterministic profitability decision, explicit metrics, and a state snapshot that downstream skills can consume without recomputing costs.

## Canonical Input Contract

`amountIn` and `expectedOut` must be expressed in the same `accountingUnit`.
This skill accepts the catalog wrapper payload only.

```json
{
  "input": {
    "route": "sbtc_to_usdc",
    "amountIn": 100000
  },
  "state": {
    "marketQuotesByRoute": {
      "sbtc_to_usdc": {
        "accountingUnit": "usd_cents",
        "expectedOut": 101200,
        "feeBps": 30,
        "slippageBps": 50
      }
    }
  },
  "now": "2026-03-27T00:00:00.000Z"
}
```

Required fields:

- `input.route`: non-empty string after trimming
- `input.amountIn`: positive safe integer
- `state.marketQuotesByRoute[route]`: quote object or absent
- `now`: canonical UTC timestamp in exact `YYYY-MM-DDTHH:mm:ss.sssZ`

`now` is validated twice:

- it must match the exact UTC millisecond shape
- it must round-trip through `Date(...).toISOString()` without change

Malformed timestamps are rejected even when they look superficially valid.

## Quote Semantics

`amountIn` and `expectedOut` are not raw token quantities from different assets.
They must already be normalized into the same accounting unit, expressed as integer minor units.

Example:

- `accountingUnit: "usd_cents"`
- `amountIn: 100000` means USD 1,000.00 of normalized input notional
- `expectedOut: 101200` means USD 1,012.00 of gross output value before subtracting `feeBps` and `slippageBps`

This skill does not prove that upstream normalization is economically correct.
It only assumes that normalization has already happened.

## Cost Model

Public cost basis is fixed:

- `costBasis = "amountIn"`

Applied math:

1. `fee = ceil(amountIn * feeBps / 10000)`
2. `slippage = ceil(amountIn * slippageBps / 10000)`
3. `totalCosts = fee + slippage`
4. `netOut = expectedOut - totalCosts`
5. `pnl = netOut - amountIn`

Model intent:

- deterministic route screening
- conservative cost rounding
- no floating-point arithmetic

Model limits:

- not a venue-specific execution simulator
- not an AMM pricing engine
- not a cross-asset normalization layer

## Semantic Tags

- `defi`: related to route economics in DeFi-style workflows
- `deterministic`: the same `input + state + now` always produces the same result
- `state-driven`: reads canonical shared state instead of fetching live runtime data
- `analytics`: produces structured metrics and economic classification
- `state-writer`: emits downstream-consumable state updates

## Validation Rules

The skill fails deterministically with `ok: false` when any of these invariants are broken:

- missing or malformed wrapper payload
- missing or invalid `input`
- missing or invalid `state`
- missing or invalid `now`
- blank `route`
- `amountIn` not being a positive safe integer
- malformed `marketQuotesByRoute` container
- quote present but malformed
- missing or too-short `accountingUnit`
- `expectedOut` not being a safe integer `>= 0`
- `feeBps` not being an integer in `[0, 10000]`
- `slippageBps` not being an integer in `[0, 10000]`
- any derived numeric result that cannot be represented as a safe integer in output

The skill rejects invalid economics instead of coercing values.

## Decision Rules

- missing route quote -> `UNKNOWN`
- `netOut <= 0` -> `UNPROFITABLE`
- `0 < netOut < amountIn` -> `UNPROFITABLE_AFTER_COSTS`
- `netOut == amountIn` -> `BREAK_EVEN`
- `netOut > amountIn` -> `PROFITABLE`

Field semantics:

- `profitable`: `true` only when `pnl > 0`
- `eligible`: `true` only when this skill does not economically block the route

That means:

- `PROFITABLE` -> `eligible: true`
- `BREAK_EVEN` -> `eligible: true`
- `UNPROFITABLE`, `UNPROFITABLE_AFTER_COSTS`, `UNKNOWN` -> `eligible: false`

`eligible` is intentionally narrower than "route exists" and broader than "strictly profitable".

## Success Output Contract

Every success output includes:

- `ok: true`
- `skill: "route-profitability-estimator"`
- `schemaVersion: "1.1.0"`
- `decision`
- `metrics`
- `stateUpdates`
- `auditEntry`

Canonical `PROFITABLE` example:

```json
{
  "ok": true,
  "skill": "route-profitability-estimator",
  "schemaVersion": "1.1.0",
  "decision": {
    "route": "sbtc_to_usdc",
    "status": "PROFITABLE",
    "profitable": true,
    "eligible": true,
    "reason": "NET_OUT_ABOVE_AMOUNT_IN",
    "evaluatedAt": "2026-03-27T00:00:00.000Z"
  },
  "metrics": {
    "costBasis": "amountIn",
    "accountingUnit": "usd_cents",
    "amountIn": 100000,
    "expectedOut": 101200,
    "feeBps": 30,
    "slippageBps": 50,
    "fee": 300,
    "slippage": 500,
    "totalCosts": 800,
    "netOut": 100400,
    "pnl": 400
  },
  "stateUpdates": {
    "routeProfitabilityByRoute": {
      "sbtc_to_usdc": {
        "schemaVersion": "1.1.0",
        "route": "sbtc_to_usdc",
        "accountingUnit": "usd_cents",
        "amountIn": 100000,
        "expectedOut": 101200,
        "costBasis": "amountIn",
        "feeBps": 30,
        "slippageBps": 50,
        "fee": 300,
        "slippage": 500,
        "totalCosts": 800,
        "netOut": 100400,
        "pnl": 400,
        "status": "PROFITABLE",
        "profitable": true,
        "eligible": true,
        "evaluatedAt": "2026-03-27T00:00:00.000Z"
      }
    }
  },
  "auditEntry": {
    "skill": "route-profitability-estimator",
    "schemaVersion": "1.1.0",
    "route": "sbtc_to_usdc",
    "status": "PROFITABLE",
    "reason": "NET_OUT_ABOVE_AMOUNT_IN",
    "profitable": true,
    "eligible": true,
    "pnl": 400,
    "netOut": 100400,
    "accountingUnit": "usd_cents",
    "costBasis": "amountIn",
    "evaluatedAt": "2026-03-27T00:00:00.000Z"
  }
}
```

For `UNKNOWN`, the output still counts as success, but remains minimal:

```json
{
  "ok": true,
  "skill": "route-profitability-estimator",
  "schemaVersion": "1.1.0",
  "decision": {
    "route": "missing_route",
    "status": "UNKNOWN",
    "profitable": null,
    "eligible": false,
    "reason": "MISSING_ROUTE_QUOTE",
    "evaluatedAt": "2026-03-27T00:00:00.000Z"
  },
  "metrics": {
    "costBasis": "amountIn"
  },
  "stateUpdates": {
    "routeProfitabilityByRoute": {
      "missing_route": {
        "schemaVersion": "1.1.0",
        "route": "missing_route",
        "status": "UNKNOWN",
        "profitable": null,
        "eligible": false,
        "evaluatedAt": "2026-03-27T00:00:00.000Z"
      }
    }
  },
  "auditEntry": {
    "skill": "route-profitability-estimator",
    "schemaVersion": "1.1.0",
    "route": "missing_route",
    "status": "UNKNOWN",
    "reason": "MISSING_ROUTE_QUOTE",
    "profitable": null,
    "eligible": false,
    "evaluatedAt": "2026-03-27T00:00:00.000Z"
  }
}
```

## Error Contract

Every error output includes:

- `ok: false`
- `skill: "route-profitability-estimator"`
- `schemaVersion: "1.1.0"`
- `error`: stable code
- optional `details`

Canonical error example:

```json
{
  "ok": false,
  "skill": "route-profitability-estimator",
  "schemaVersion": "1.1.0",
  "error": "INVALID_SLIPPAGE_BPS",
  "details": {
    "route": "sbtc_to_usdc"
  }
}
```

Documented error codes:

- `INVALID_PAYLOAD`
- `INVALID_INPUT_WRAPPER`
- `INVALID_STATE`
- `MISSING_OR_INVALID_NOW`
- `MISSING_ROUTE`
- `INVALID_AMOUNT_IN`
- `INVALID_MARKET_QUOTES_STATE`
- `INVALID_ROUTE_QUOTE`
- `INVALID_ACCOUNTING_UNIT`
- `INVALID_EXPECTED_OUT`
- `INVALID_FEE_BPS`
- `INVALID_SLIPPAGE_BPS`
- `UNSAFE_FEE`
- `UNSAFE_SLIPPAGE`
- `UNSAFE_TOTAL_COSTS`
- `UNSAFE_NET_OUT`
- `UNSAFE_PNL`
- `MISSING_INPUT`
- `INVALID_JSON_INPUT`

`details` policy:

- `details.route` is included only when the route value was already parsed successfully before the failure
- global parsing errors, such as `INVALID_PAYLOAD` or `MISSING_OR_INVALID_NOW` before obtaining a valid route, do not carry `details.route`

## State Read

- `marketQuotesByRoute.<route>.accountingUnit`
- `marketQuotesByRoute.<route>.expectedOut`
- `marketQuotesByRoute.<route>.feeBps`
- `marketQuotesByRoute.<route>.slippageBps`

## State Write

- `routeProfitabilityByRoute.<route>`

The written snapshot is intentionally rich enough for downstream skills to consume without recomputing route costs.
It persists both `profitable` and `eligible`, avoiding status-code reinterpretation.

## Isolation

- no wallet calls
- no market fetches
- no mutation outside `stateUpdates`
- no dependency on other skills
- no system clock fallback

## Reuse And Composition

Downstream consumers can use:

- `decision.status` for gating
- `decision.eligible` for "not economically blocked by this skill"
- `decision.profitable` for strict upside checks
- `metrics.pnl` for ranking
- `stateUpdates.routeProfitabilityByRoute.<route>` as durable shared state
- `auditEntry` for traceability

Example downstream consumption:

- a route selector can filter snapshots where `eligible === true`
- a ranker can order surviving routes by `pnl`
- an audit skill can persist only `auditEntry` without recomputing economics

## Comparability

This skill does not create comparability across routes by itself.
It only preserves comparability when upstream already normalized all compared routes into the same economic unit.

Safe claim:

- outputs are directly comparable when `accountingUnit` matches and upstream normalization is trustworthy

Unsafe claim:

- identical `accountingUnit` labels automatically prove economic equivalence

That upstream guarantee remains out of scope.

## What This Skill Does Not Do

- fetch quotes
- normalize values across different assets
- verify whether upstream normalization is correct
- model venue-specific fee semantics
- execute trades

## Validation Fixtures

Executable fixtures live in `skills/route-profitability-estimator/examples/`.
Each `*.json` may have a companion `*.expected.json` file.
`run-example.cjs` executes the skill and fails when the current output diverges from the expected output.

Coverage included:

- profitable route
- unprofitable route after costs
- missing quote -> `UNKNOWN`
- negative fee bps rejection
- slippage bps above maximum rejection
- invalid accounting unit rejection
- invalid quotes container rejection
- invalid timestamp rejection
- blank route rejection
- max-bps edge case
- zero expected output
- break-even via conservative rounding
- large values that remain safe
- unsafe derived magnitude rejection

Run one fixture:

```bash
node skills/route-profitability-estimator/run-example.cjs skills/route-profitability-estimator/examples/profitable.json
```

Run all fixtures:

```bash
node skills/route-profitability-estimator/validate-examples.cjs
```

Run the implementation directly:

```bash
node skills/route-profitability-estimator/index.cjs skills/route-profitability-estimator/examples/profitable.json
```

The direct path executes the skill.
The wrapper executes the skill and compares the result with `profitable.expected.json`.
The aggregated validator runs every fixture and fails on the first contract drift.
