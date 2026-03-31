---
name: route-risk-adjusted-profitability
description: "Deterministic risk-adjusted profitability classifier"
metadata:
  name: route-risk-adjusted-profitability
  description: "Deterministic risk-adjusted profitability classifier"
  author: "luizinhotec"
  version: "1"
  entry: "route-risk-adjusted-profitability/index.cjs"
  requires: "state"
  tags: "defi, deterministic, analytics"
  arguments: "run"
  user-invocable: "false"
---

# Route Risk Adjusted Profitability

## What it does

Calcula `adjustedPnl` de forma deterministica para uma rota usando snapshots canonicos de lucratividade e risco presentes em `state`.

## Why agents need it

Agentes precisam de um sinal simples e confiavel de lucratividade ajustada por risco para comparar rotas sem heuristicas ocultas nem dependencias externas.

## Safety notes

- nao faz chamadas de rede
- nao executa transacoes
- nao muta nada fora de `stateUpdates`
- usa apenas `state.routeProfitabilityByRoute[route]` e `state.routeRiskByRoute[route]`

## Commands

### run

```bash
node skills/route-risk-adjusted-profitability/index.cjs < skills/route-risk-adjusted-profitability/test-input.json
```

## Output contract

Saida de sucesso:

```json
{
  "ok": true,
  "stateUpdates": {
    "routeRiskAdjustedProfitabilityByRoute": {
      "sbtc_to_usdc": {
        "adjustedPnl": 250,
        "accountingUnit": "usd_cents",
        "riskScore": 0.5
      }
    }
  }
}
```

Saida de erro:

```json
{
  "ok": false,
  "error": "INVALID_RISK_SCORE"
}
```
