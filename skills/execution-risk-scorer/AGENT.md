\# execution-risk-scorer



\## Role in the system



A skill `execution-risk-scorer` avalia o risco de execução de uma rota a partir do estado consolidado do sistema.



Ela não decide execução.

Ela não bloqueia execução.

Ela apenas mede risco.



\---



\## Why this skill exists



O ecossistema precisa separar claramente:



\- análise de risco

\- decisão de execução

\- readiness

\- roteamento



Esta skill existe para concentrar apenas a avaliação de risco em um ponto isolado, reutilizável e determinístico.



\---



\## What this skill reads



A skill pode consumir, quando disponíveis:



\- `routeHealthByRoute`

\- `protocolHealthByProtocol`

\- `routeScoreByRoute`

\- `executionPolicyByRoute`

\- `routeOperatorByRoute`



\---



\## What this skill returns



A skill retorna:



\- `riskLevel`

\- `riskScore`

\- `reason`



Formato esperado:



```json

{

&#x20; "ok": true,

&#x20; "route": "hbtc\_to\_btc\_l1",

&#x20; "riskLevel": "high",

&#x20; "riskScore": 65,

&#x20; "reason": "ROUTE\_UNDERPERFORMING | PROTOCOL\_DEGRADED"

}

