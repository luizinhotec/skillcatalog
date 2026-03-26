---
name: execution-readiness-guard
description: Deterministic execution gating skill that classifies a route as ready, degraded, blocked, or unknown using operator, route health, protocol health, and route score signals.
tags:
  - execution
  - safety
  - routing
---

# Execution Readiness Guard

## Overview

Execution Readiness Guard is an isolated, reusable skill that determines whether a route is eligible for execution.

It evaluates four decision layers in strict order:

1. route operator decision
2. route health
3. protocol health
4. route score

The skill returns a deterministic readiness result:

- `ready`
- `degraded`
- `blocked`
- `unknown`

Missing or invalid data is never assumed safe.

## Decision Contract

- `routeOperator.decision === "BLOCK"` blocks the route at operator level
- `routeHealth.status === "blocked"` blocks the route
- `protocolHealth.status === "blocked"` blocks the protocol
- `routeScore.status === "degraded"` marks execution as degraded

Important:

- This skill does not use `routeOperator.status`
- Only `routeOperator.decision` is considered for operator-level blocking
- Missing or undefined fields must never be assumed safe

## Input

```json
{
  "route": "hbtc_to_btc_l1",
  "state": {
    "routeOperatorByRoute": {
      "hbtc_to_btc_l1": {
        "decision": "ALLOW",
        "protocol": "hermetica"
      }
    },
    "routeHealthByRoute": {
      "hbtc_to_btc_l1": {
        "status": "healthy",
        "reason": "ROUTE_CLEAR"
      }
    },
    "protocolHealthByProtocol": {
      "hermetica": {
        "status": "healthy",
        "reason": "PROTOCOL_CLEAR"
      }
    },
    "routeScoreByRoute": {
      "hbtc_to_btc_l1": {
        "status": "healthy",
        "reason": "ROUTE_SCORE_OK",
        "score": 90
      }
    }
  }
}
```

## Output

```json
{
  "ok": true,
  "skill": "execution-readiness-guard",
  "route": "hbtc_to_btc_l1",
  "readiness": "ready",
  "eligible": true,
  "reason": "EXECUTION_READY"
}
```

If required data is missing, the skill returns `unknown` with `eligible: false` when evaluation can still proceed for the provided route, or an explicit top-level error when `route` or `state` is invalid.
