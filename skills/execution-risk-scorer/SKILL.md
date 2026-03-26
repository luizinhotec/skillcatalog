\# execution-risk-scorer



\## Purpose



Avaliar o risco de execução de uma rota com base no estado atual do sistema.



Esta skill NÃO toma decisão de execução.

Ela apenas calcula risco.



\---



\## Responsibilities



\- Ler estado consolidado

\- Avaliar fatores de risco da rota

\- Produzir score numérico (0–100)

\- Classificar nível de risco

\- Explicar o motivo do risco



\---



\## Non-Responsibilities



\- NÃO bloquear execução

\- NÃO permitir execução

\- NÃO alterar decisões de outras skills

\- NÃO conter lógica de roteamento



\---



\## Input



```json

{

&#x20; "route": "string",

&#x20; "state": {

&#x20;   "routeHealthByRoute": {},

&#x20;   "protocolHealthByProtocol": {},

&#x20;   "routeScoreByRoute": {},

&#x20;   "executionPolicyByRoute": {}

&#x20; }

}

