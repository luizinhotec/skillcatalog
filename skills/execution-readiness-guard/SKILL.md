---
name: execution-readiness-guard
description: Deterministic execution gating skill that classifies a route as ready, degraded, blocked, or unknown using operator, route health, protocol health, and route score signals.
tags:
  - risk
  - execution
  - safety
  - routing
---

# Execution Readiness Guard

## Overview

Execution Readiness Guard is an isolated, reusable skill that determines whether a route is eligible for execution.

It evaluates four decision layers:

- route operator decision
- route health
- protocol health
- route score

The skill returns a deterministic readiness result:

- `ready`
- `degraded`
- `blocked`
- `unknown`

It is designed to be used as an execution gating primitive inside routing and automation systems.

## Why this matters

A route can be technically allowed and still be a poor execution candidate.

This skill separates:

- technical permission
- operational safety
- execution quality

That makes it useful as a reusable guardrail for any system that must decide whether execution should proceed.

## Decision Order

The evaluation order is strict:

1. route operator decision
2. route health
3. protocol health
4. route score

Blocking conditions take priority over degraded conditions.

## Inputs

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
        "status": "degraded",
        "reason": "ROUTE_UNDERPERFORMING",
        "score": 29
      }
    }
  }
}