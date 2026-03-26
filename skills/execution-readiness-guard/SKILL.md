# Execution Readiness Guard

## Purpose

Execution Readiness Guard is a final decision skill that evaluates whether a route is ready for execution based on consolidated state.

It reads existing route/operator/protocol/score state and returns a discriminated readiness result:

- `healthy`
- `degraded`
- `blocked`

## Input

```json
{
  "route": "hbtc_to_btc_l1",
  "state": {
    "routeOperatorByRoute": {},
    "routeHealthByRoute": {},
    "protocolHealthByProtocol": {},
    "routeScoreByRoute": {}
  }
}