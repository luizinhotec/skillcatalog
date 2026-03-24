'use strict';

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
  for (const [key, value] of Object.entries(patch || {})) {
    state[key] = value;
  }
  return state;
}

function runIncidentSkill(state, payload) {
  const result = protocolIncidentGuard.run({
    ...payload,
    state,
    context: {
      ...(payload.context || {}),
      state
    }
  });

  if (!result?.ok) {
    throw new Error('Skill 2 falhou');
  }

  if (result.statePatch) {
    applyPatch(state, result.statePatch);
  }

  return result;
}

function runRouteSkill(state, payload) {
  const result = btcL1RouteOperator.operate({
    ...payload,
    state,
    context: {
      ...(payload.context || {}),
      state
    }
  });

  if (!result?.statePatch) {
    console.log('DEBUG route result:', result);
    throw new Error('Skill 1 não retornou statePatch');
  }

  applyPatch(state, result.statePatch);
  return result;
}

function runPolicySkill(state, route) {
  const result = executionPolicyGuard.run({
    state,
    route,
    context: { state }
  });

  if (!result?.statePatch) {
    console.log('DEBUG policy result:', result);
    throw new Error('Skill 3 não retornou statePatch');
  }

  applyPatch(state, result.statePatch);
  return result;
}

function getResolvedRoute(routeResult) {
  const routeMap = routeResult?.statePatch?.routeOperatorByRoute || {};
  const routes = Object.keys(routeMap);
  const route = routes[0];

  if (!route) {
    throw new Error('Nenhuma rota foi resolvida pela Skill 1');
  }

  return {
    route,
    entry: routeMap[route]
  };
}

function main() {
  const originalState = readState();
  const state = createBaseState();

  const incidentPayload = {
    protocol: 'hermetica',
    functionName: 'request-redeem',
    errorCode: null,
    errorName: null,
    context: {
      hqProtocolState: {
        'vault-hbtc-v1': true,
        'state-hbtc-v1': true,
        'protocol-enabled': true
      }
    }
  };

  const routePayload = {
    route: 'hbtc_to_btc_l1',
    protocol: 'hermetica',
    assetIn: 'hbtc',
    assetOut: 'btc_l1'
  };

  try {
    writeState(clone(state));

    const incidentResult = runIncidentSkill(state, incidentPayload);
    const routeResult = runRouteSkill(state, routePayload);
    const resolved = getResolvedRoute(routeResult);
    const policyResult = runPolicySkill(state, resolved.route);

    writeState(state);

    console.log(
      JSON.stringify(
        {
          ok: true,
          pipeline: [
            'protocol-incident-guard',
            'btc-l1-route-operator',
            'execution-policy-guard'
          ],
          incidentDetected: incidentResult.incidentDetected === true,
          route: resolved.route,
          protocol: resolved.entry?.protocol || null,
          pathVariant: resolved.entry?.pathVariant || null,
          variantPriority: resolved.entry?.variantPriority ?? null,
          decision: policyResult.decision || state.lastExecutionPolicyDecision?.decision || null,
          reason: policyResult.reason || state.lastExecutionPolicyDecision?.reason || null,
          stateSummary: {
            lastProtocolIncidentType: state.lastProtocolIncident?.type || null,
            lastRouteOperation: state.lastRouteOperation || null,
            lastExecutionPolicyDecision: state.lastExecutionPolicyDecision || null
          }
        },
        null,
        2
      )
    );
  } finally {
    writeState(originalState);
  }
}

main();