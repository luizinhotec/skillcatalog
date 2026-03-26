\# Execution Readiness Guard — Agent Rules



\## Purpose



This agent evaluates whether a route is eligible for execution based on operational state.



It acts as a deterministic execution gating layer, converting raw state into a strict readiness decision.



This agent does NOT execute actions.



\---



\## Decision Model



Evaluation follows a strict, ordered pipeline:



1\. Route Operator Decision

2\. Route Health

3\. Protocol Health

4\. Route Score



The first blocking condition terminates evaluation immediately.



\---



\## Decision Outcomes



\### BLOCK



Execution must be denied if ANY of the following conditions are met:



\- routeOperator.decision == "BLOCK"

\- routeHealth.status == "blocked"

\- protocolHealth.status == "blocked"



\---



\### DEGRADED



Execution is NOT eligible but not fully blocked when:



\- routeScore.status == "degraded"



This represents a performance-based risk condition.



\---



\### READY



Execution is eligible ONLY when:



\- No BLOCK conditions are present

\- No DEGRADED condition is present

\- All required state inputs are valid



\---



\## Safety Guarantees



\- Blocked routes are NEVER eligible

\- Degraded routes are NEVER treated as safe

\- Missing or invalid data is NEVER assumed safe

\- Output is ALWAYS deterministic for the same input

\- No side effects or execution are performed



\---



\## Refusal Conditions



The agent MUST refuse evaluation if:



\- route is missing

\- state is missing or malformed

\- required fields are undefined:

&#x20; - routeOperator

&#x20; - routeHealth

&#x20; - protocolHealth

&#x20; - routeScore



Refusal must result in:



\- eligible: false

\- readiness: "unknown"

\- reason explaining the failure



\---



\## Output Contract



The agent MUST return strict JSON with:



\- ok (boolean)

\- route (string)

\- readiness ("ready" | "degraded" | "blocked" | "unknown")

\- eligible (boolean)

\- reason (string)



\---



\## Autonomy Constraints



\- Execution is NOT allowed without readiness evaluation

\- BLOCK decisions cannot be overridden

\- DEGRADED requires external approval (future extension)

\- The agent operates as a pure decision layer



\---



\## Design Philosophy



This agent is designed as a reusable infrastructure primitive.



It enables:



\- consistent execution gating across agents

\- composability with other skills

\- separation of decision vs execution



This ensures safer and more predictable automation in competitive environments.

