Day 3 submission for AIBTC Skills Competition.

Skill: `route-profitability-estimator`

Final status:
- hardcore review passed
- submission package ready
- aggregated fixture validation available via `node skills/route-profitability-estimator/validate-examples.cjs`

Suggested compare:
- base: `competition/main`
- head: `submit-day3-route-profitability-estimator`

Scope:
- `skills/route-profitability-estimator/SKILL.md`
- `skills/route-profitability-estimator/index.cjs`
- `skills/route-profitability-estimator/run-example.cjs`
- `skills/route-profitability-estimator/validate-examples.cjs`
- `skills/route-profitability-estimator/examples/*.json`
- `skills/route-profitability-estimator/examples/*.expected.json`

What this skill does:
- reads one route quote from shared state
- applies deterministic cost math using `amountIn` as the public cost basis
- classifies the route as `UNKNOWN`, `UNPROFITABLE`, `UNPROFITABLE_AFTER_COSTS`, `BREAK_EVEN`, or `PROFITABLE`
- writes a reusable snapshot to `stateUpdates.routeProfitabilityByRoute[route]`

What this skill does not claim:
- it does not fetch quotes
- it does not normalize values across assets
- it does not prove that upstream quote normalization is economically correct
- it does not act as a venue-specific execution simulator

Hard contract choices:
- canonical wrapper input only
- required canonical UTC timestamp with round-trip validation
- integer-only math using `BigInt`
- conservative rounding with `ceil`
- explicit `ok: false` on malformed inputs or unsafe derived magnitudes
- schema version on both success and failure outputs

Public math:
- `fee = ceil(amountIn * feeBps / 10000)`
- `slippage = ceil(amountIn * slippageBps / 10000)`
- `totalCosts = fee + slippage`
- `netOut = expectedOut - totalCosts`
- `pnl = netOut - amountIn`

Eligibility semantics:
- `eligible: true` means this skill does not economically block the route
- `PROFITABLE` and `BREAK_EVEN` are eligible
- `UNKNOWN`, `UNPROFITABLE`, and `UNPROFITABLE_AFTER_COSTS` are not

Comparability claim kept narrow:
- outputs are comparable only when upstream has already normalized compared routes into the same trustworthy `accountingUnit`
- matching `accountingUnit` text alone is not treated as proof of economic equivalence

Why this is a catalog skill instead of a loose script:
- isolated input, output, state read, and state write contract
- no external I/O beyond CLI file reading
- deterministic for the same `input + state + now`
- downstream-consumable decision, metrics, state snapshot, and audit record
- fixture-based validation with frozen expected outputs

Downstream consumption example:
- selector step reads `stateUpdates.routeProfitabilityByRoute[route].eligible`
- ranking step orders remaining routes by `stateUpdates.routeProfitabilityByRoute[route].pnl`
- audit step stores `auditEntry` as a minimal trace record without re-running the math

Validation artifacts included:
- success fixtures
- unknown-route fixture
- malformed state fixtures
- malformed timestamp fixture
- malformed route fixture
- unsafe magnitude fixture
- explicit expected outputs for every documented fixture
- aggregated validator for all fixtures

Fixture matrix:

| Fixture | Expected result | What it proves |
| --- | --- | --- |
| `profitable.json` | `PROFITABLE` | baseline positive pnl path |
| `unprofitable.json` | `UNPROFITABLE_AFTER_COSTS` | costs can flip a naive profitable quote |
| `unknown.json` | `UNKNOWN` | missing quote is not coerced into a fake decision |
| `invalid-negative-fee-bps.json` | `INVALID_FEE_BPS` | negative fee rejection |
| `invalid-slippage-bps.json` | `INVALID_SLIPPAGE_BPS` | slippage upper-bound rejection |
| `invalid-accounting-unit.json` | `INVALID_ACCOUNTING_UNIT` | accounting unit validation |
| `invalid-market-quotes-state.json` | `INVALID_MARKET_QUOTES_STATE` | malformed shared-state container rejection |
| `invalid-now.json` | `MISSING_OR_INVALID_NOW` | malformed-but-well-shaped date rejection |
| `invalid-route-blank.json` | `MISSING_ROUTE` | trimmed route contract enforcement |
| `extreme-bps.json` | `UNPROFITABLE` | 10000 bps edge handling |
| `zero-expected-out.json` | `UNPROFITABLE` | non-positive net-out path |
| `minimal-rounding.json` | `BREAK_EVEN` | conservative ceil rounding behavior |
| `large-values-safe.json` | `UNPROFITABLE_AFTER_COSTS` | large safe integer path |
| `unsafe-output-magnitude.json` | `UNSAFE_TOTAL_COSTS` | rejection of unsafe derived outputs |

Validation executed:

```bash
node skills/route-profitability-estimator/validate-examples.cjs
```

Expected validation behavior:
- the validator exits `0` only when every fixture matches its companion `*.expected.json`
- the validator exits `1` if any fixture input cannot be read, any expected file cannot be read, or any actual output drifts from the frozen expectation
- expected business failures such as invalid inputs still count as validation success when the fixture matches its expected error output
