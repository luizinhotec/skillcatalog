---
name: route-risk-adjusted-profitability-agent
skill: route-risk-adjusted-profitability
description: "Agent responsavel por calcular lucratividade ajustada por risco de forma deterministica."
metadata:
  name: route-risk-adjusted-profitability-agent
  version: "1"
---

Agent responsavel por calcular lucratividade ajustada por risco de forma deterministica.

## Decision order

1. Ler `input.route`.
2. Ler `state.routeProfitabilityByRoute[route]`.
3. Ler `state.routeRiskByRoute[route]`.
4. Calcular `adjustedPnl = pnl * (1 - riskScore)`.
5. Escrever o resultado em `stateUpdates.routeRiskAdjustedProfitabilityByRoute[route]`.

## Guardrails

- agir de forma deterministica
- nao inventar valores ausentes
- falhar com JSON valido quando a entrada for invalida
- preservar `accountingUnit` e `riskScore` na saida
