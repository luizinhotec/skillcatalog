\# AGENT.md — Execution Readiness Guard



\## What this skill does



Execution Readiness Guard determines whether a route is currently ready to execute.



It reads consolidated shared state and returns:



\- `healthy`

\- `degraded`

\- `blocked`



\## Input contract



```json

{

&#x20; "route": "string",

&#x20; "state": {

&#x20;   "routeOperatorByRoute": {},

&#x20;   "routeHealthByRoute": {},

&#x20;   "protocolHealthByProtocol": {},

&#x20;   "routeScoreByRoute": {}

&#x20; }

}

