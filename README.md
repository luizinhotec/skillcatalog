# Skill Catalog

Catalogo de skills isoladas, reutilizaveis e composaveis.

Este repositorio segue a direcao oficial:

- o sistema nao e um agente monolitico
- o runtime e fino e so orquestra
- toda regra nova nasce como skill
- o estado compartilhado e a interface entre skills

## Estrutura oficial

```text
runtime/
  orchestrator.cjs
skills/
  <skill-name>/
    SKILL.md
    AGENT.md
    index.cjs
    test-input.json
state/
  skill-state.json
```

## Contrato de execucao

Cada skill recebe um payload com:

```json
{
  "input": {},
  "state": {},
  "now": "2026-03-27T00:00:00.000Z"
}
```

Cada skill responde com:

```json
{
  "ok": true,
  "skill": "example-skill",
  "decision": {},
  "stateUpdates": {},
  "auditEntry": {}
}
```

Regras obrigatorias:

- a skill deve ser executavel isoladamente
- a skill nao depende diretamente de outra skill
- a skill nao executa efeitos externos irreversiveis
- a skill le do estado e escreve no estado de forma rastreavel
- a skill deve ser deterministica para o mesmo `input` + `state` + `now`

## Runtime

O runtime oficial esta em [`runtime/orchestrator.cjs`](/C:/dev/skillcatalog/runtime/orchestrator.cjs).

Ele faz apenas quatro coisas:

1. le `input` e `state`
2. carrega a skill selecionada
3. executa a skill
4. aplica `stateUpdates` no arquivo de estado e registra auditoria

Ele nao contem regra de negocio.

O runtime deve ser usado de forma serial sobre o mesmo arquivo de estado.

## Como executar

Exemplo com a skill `execution-readiness-guard`:

```bash
node runtime/orchestrator.cjs execution-readiness-guard skills/execution-readiness-guard/test-input.json state/skill-state.json
```

Exemplo com a skill `zest-yield-manager`:

```bash
node runtime/orchestrator.cjs zest-yield-manager skills/zest-yield-manager/test-input.json state/skill-state.json
```

Exemplo com a skill `bitflow-hodlmm-manager`:

```bash
node runtime/orchestrator.cjs bitflow-hodlmm-manager skills/bitflow-hodlmm-manager/test-input.json state/skill-state.json
```

Exemplo com a skill `route-profitability-estimator`:

```bash
node skills/route-profitability-estimator/validate-examples.cjs
```

Ou executar pelo runtime com um fixture:

```bash
node runtime/orchestrator.cjs route-profitability-estimator skills/route-profitability-estimator/examples/profitable.json state/skill-state.json
```

## O que mudou

O repositorio foi corrigido para remover desvios da direcao oficial:

- skills deixaram de agir como CLIs monoliticas com regras internas extensas
- logica de decisao saiu de fluxos acoplados a comandos e foi para skills isoladas
- runtime explicito foi adicionado e mantido fino
- estado foi promovido a interface principal entre skills
- documentacao e template foram alinhados ao padrao oficial
