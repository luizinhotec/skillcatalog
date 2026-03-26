# Execution Readiness Guard

## Purpose

This skill evaluates whether a route is eligible for execution based on operational state.

It acts as a deterministic execution gating layer that converts raw state into a strict readiness decision.

This skill does not execute actions.

## Decision Model

Evaluation follows a strict ordered pipeline:

1. Route operator decision
2. Route health
3. Protocol health
4. Route score

The first blocking condition terminates evaluation immediately.

## Decision Contract

- `routeOperator.decision === "BLOCK"` blocks the route at operator level
- `routeHealth.status === "blocked"` blocks the route
- `protocolHealth.status === "blocked"` blocks the protocol
- `routeScore.status === "degraded"` marks execution as degraded

Important:

- This skill does not use `routeOperator.status`
- Only `routeOperator.decision` is considered for operator-level blocking
- Missing or undefined fields must never be assumed safe

## Decision Outcomes

### Blocked

Execution must be denied if any of the following conditions are met:

- `routeOperator.decision === "BLOCK"`
- `routeHealth.status === "blocked"`
- `protocolHealth.status === "blocked"`

### Degraded

Execution is not eligible but not fully blocked when:

- `routeScore.status === "degraded"`

### Ready

Execution is eligible only when:

- no blocked condition is present
- no degraded condition is present
- all required state inputs are valid

### Unknown

Evaluation returns `unknown` with `eligible: false` when required route-specific state is missing:

- route operator
- route health
- protocol reference
- protocol health
- route score

## Safety Guarantees

- Blocked routes are never eligible.
- Degraded routes are never treated as safe.
- Missing or invalid data is never assumed safe.
- Output is deterministic for the same input.
- No side effects or execution are performed by the skill contract.

## Output Contract

The skill returns strict JSON with:

- `ok`
- `skill`
- `route` when evaluation runs
- `readiness`
- `eligible`
- `reason`

Invalid top-level input returns:

- `ok: false`
- `skill: "execution-readiness-guard"`
- `error`
