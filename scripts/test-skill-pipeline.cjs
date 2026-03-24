'use strict';

const assert = require('assert');

const { readState, writeState } = require('../lib/skill-state-store.cjs');
const protocolIncidentGuard = require('../skills/protocol-incident-guard/index.cjs');
const btcL1RouteOperator = require('../skills/btc-l1-route-operator/index.cjs');
const executionPolicyGuard = require('../skills/execution-policy-guard/index.cjs');

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function createBaseState() {
  return {
    catalogVersion: 1,
    skillStatusById: {},
    protocolHealthByProtocol: {},
    routeHealthByRoute: {},
    incidentHistory: [],
    lastProtocolIncident: null,
    routeOperatorByRoute: {},
    lastRouteOperation: null,
    routeOperationHistory: [],
    executionPolicyByRoute: {},
    lastExecutionPolicyDecision: null,
    executionPolicyHistory: [],
    routeHistory: [],
    alertCooldowns: {}
  };
}

function applyPatch(state, patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    state[k] = v;
  }
  return state;
}

function callRouteSkill(state) {
  return btcL1RouteOperator.operate({
    route: 'hbtc_to_btc_l1',
    protocol: 'hermetica',
    assetIn: 'hbtc',
    assetOut: 'btc_l1',
    state,
    context: { state }
  });
}

function callPolicySkill(state, route) {
  return executionPolicyGuard.run({
    state,
    route,
    context: { state }
  });
}

function callIncidentSkill(state) {
  return protocolIncidentGuard.run({
    state,
    protocol: 'hermetica',
    functionName: 'request-redeem',
    errorCode: 'u101008',
    errorName: 'ERR_NOT_PROTOCOL',
    context: {
      hqProtocolState: {
        'vault-hbtc-v1': false,
        'state-hbtc-v1': true,
        'protocol-enabled': true
      },
      state
    }
  });
}

function getRoutePatch(result) {
  if (!result?.statePatch) {
    console.log('DEBUG route result:', result);
    throw new Error('Skill route não retornou statePatch');
  }

  return result.statePatch;
}

function getPolicyPatch(result) {
  if (!result?.statePatch) {
    console.log('DEBUG policy result:', result);
    throw new Error('Skill policy não retornou statePatch');
  }

  return result.statePatch;
}

function getIncidentPatch(result) {
  if (!result?.statePatch) {
    console.log('DEBUG incident result:', result);
    throw new Error('Skill incident não retornou statePatch');
  }

  return result.statePatch;
}

function getResolvedRoute(routePatch) {
  const map = routePatch.routeOperatorByRoute || {};
  const routes = Object.keys(map);
  const route = routes[0];

  assert.ok(route, 'Nenhuma rota resolvida pela Skill 1');

  const entry = map[route];

  assert.ok(entry, 'Entrada da rota não encontrada');
  assert.ok(entry.pathVariant, 'Skill 1 não resolveu pathVariant');
  assert.ok(typeof entry.variantPriority !== 'undefined', 'Skill 1 não resolveu variantPriority');

  return {
    route,
    entry
  };
}

function getDecisionFromState(state, route) {
  const decision = state.executionPolicyByRoute?.[route];

  assert.ok(decision, `Decisão não encontrada para a rota ${route}`);

  return decision;
}

function scenarioHealthy(base) {
  const s = clone(base);

  const routeResult = callRouteSkill(s);
  const routePatch = getRoutePatch(routeResult);
  applyPatch(s, routePatch);

  const { route, entry } = getResolvedRoute(routePatch);

  const policyResult = callPolicySkill(s, route);
  const policyPatch = getPolicyPatch(policyResult);
  applyPatch(s, policyPatch);

  const decision = getDecisionFromState(s, route);

  assert.strictEqual(decision.decision, 'ALLOW', 'Cenário 1 deveria retornar ALLOW');
  assert.strictEqual(s.lastExecutionPolicyDecision.decision, 'ALLOW');
  assert.strictEqual(s.lastExecutionPolicyDecision.route, route);
  assert.strictEqual(s.routeOperatorByRoute[route].pathVariant, entry.pathVariant);

  return {
    scenario: 'healthy',
    route,
    protocol: entry.protocol,
    pathVariant: entry.pathVariant,
    variantPriority: entry.variantPriority,
    decision: decision.decision,
    reason: decision.reason
  };
}

function scenarioBlocked(base) {
  const s = clone(base);

  const incidentResult = callIncidentSkill(s);
  const incidentPatch = getIncidentPatch(incidentResult);
  applyPatch(s, incidentPatch);

  assert.ok(incidentResult?.ok, 'Skill 2 deveria retornar ok');
  assert.strictEqual(incidentResult.incidentDetected, true, 'Skill 2 deveria detectar incidente');

  assert.ok(s.lastProtocolIncident, 'Skill 2 deveria registrar lastProtocolIncident');
  assert.ok(s.protocolHealthByProtocol.hermetica, 'protocolHealth hermetica ausente');
  assert.strictEqual(
    s.protocolHealthByProtocol.hermetica.status,
    'blocked',
    'protocolHealth deveria estar blocked'
  );

  const routeResult = callRouteSkill(s);
  const routePatch = getRoutePatch(routeResult);
  applyPatch(s, routePatch);

  const { route, entry } = getResolvedRoute(routePatch);

  assert.ok(s.routeHealthByRoute[route], 'routeHealth da rota ausente');
  assert.strictEqual(
    s.routeHealthByRoute[route].status,
    'blocked',
    'routeHealth deveria estar blocked'
  );

  const policyResult = callPolicySkill(s, route);
  const policyPatch = getPolicyPatch(policyResult);
  applyPatch(s, policyPatch);

  const decision = getDecisionFromState(s, route);

  assert.strictEqual(decision.decision, 'BLOCK', 'Cenário 2 deveria retornar BLOCK');

  return {
    scenario: 'blocked',
    route,
    protocol: entry.protocol,
    pathVariant: entry.pathVariant,
    variantPriority: entry.variantPriority,
    decision: decision.decision,
    reason: decision.reason,
    incidentType: s.lastProtocolIncident.type
  };
}

function scenarioPriority(base) {
  const s = clone(base);

  const routeResult = callRouteSkill(s);
  const routePatch = getRoutePatch(routeResult);
  applyPatch(s, routePatch);

  const { route, entry } = getResolvedRoute(routePatch);

  s.routeHealthByRoute[route] = {
    status: 'blocked',
    updatedAt: new Date().toISOString(),
    reason: 'MANUAL_ROUTE_BLOCK_FOR_PRIORITY_TEST'
  };

  s.protocolHealthByProtocol[entry.protocol] = {
    status: 'healthy',
    updatedAt: new Date().toISOString(),
    reason: 'MANUAL_PROTOCOL_HEALTH_FOR_PRIORITY_TEST'
  };

  const policyResult = callPolicySkill(s, route);
  const policyPatch = getPolicyPatch(policyResult);
  applyPatch(s, policyPatch);

  const decision = getDecisionFromState(s, route);

  assert.strictEqual(decision.decision, 'BLOCK', 'Cenário 3 deveria retornar BLOCK');
  assert.strictEqual(
    decision.reason,
    'ROUTE_HEALTH_BLOCKED',
    'Prioridade deveria favorecer routeHealth sobre protocolHealth'
  );
  assert.strictEqual(s.routeHealthByRoute[route].status, 'blocked');
  assert.strictEqual(s.protocolHealthByProtocol[entry.protocol].status, 'healthy');

  return {
    scenario: 'priority',
    route,
    protocol: entry.protocol,
    routeHealthStatus: s.routeHealthByRoute[route].status,
    protocolHealthStatus: s.protocolHealthByProtocol[entry.protocol].status,
    decision: decision.decision,
    reason: decision.reason
  };
}

function main() {
  const original = readState();
  const base = createBaseState();

  writeState(base);

  try {
    const s1 = scenarioHealthy(base);
    const s2 = scenarioBlocked(base);
    const s3 = scenarioPriority(base);

    console.log('OK: test-skill-pipeline passou');
    console.log(
      JSON.stringify(
        {
          s1,
          s2,
          s3
        },
        null,
        2
      )
    );
  } finally {
    writeState(original);
  }
}

main();