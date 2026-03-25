'use strict';

const incidentSkill = require('../skills/protocol-incident-guard/index.cjs');
const routeOperatorSkill = require('../skills/btc-l1-route-operator/index.cjs');
const executionPolicySkill = require('../skills/execution-policy-guard/index.cjs');

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeState(base, patch) {
  if (!patch) {
    return base;
  }

  return {
    ...base,
    ...patch,
    skillStatusById: {
      ...(base.skillStatusById || {}),
      ...(patch.skillStatusById || {})
    },
    protocolHealthByProtocol: {
      ...(base.protocolHealthByProtocol || {}),
      ...(patch.protocolHealthByProtocol || {})
    },
    routeHealthByRoute: {
      ...(base.routeHealthByRoute || {}),
      ...(patch.routeHealthByRoute || {})
    },
    routeOperatorByRoute: {
      ...(base.routeOperatorByRoute || {}),
      ...(patch.routeOperatorByRoute || {})
    },
    executionPolicyByRoute: {
      ...(base.executionPolicyByRoute || {}),
      ...(patch.executionPolicyByRoute || {})
    },
    alertCooldowns: {
      ...(base.alertCooldowns || {}),
      ...(patch.alertCooldowns || {})
    },
    incidentHistory: patch.incidentHistory || base.incidentHistory || [],
    routeOperationHistory: patch.routeOperationHistory || base.routeOperationHistory || [],
    executionPolicyHistory: patch.executionPolicyHistory || base.executionPolicyHistory || []
  };
}

function invokeSkill(skillModule, payload) {
  if (skillModule && typeof skillModule.detect === 'function') {
    return skillModule.detect(payload);
  }

  if (skillModule && typeof skillModule.run === 'function') {
    return skillModule.run(payload);
  }

  if (skillModule && typeof skillModule.operate === 'function') {
    return skillModule.operate(payload);
  }

  throw new Error('Skill module has no callable entrypoint (detect/run/operate)');
}

function createBaseState() {
  return {
    catalogVersion: 1,
    skillStatusById: {},
    protocolHealthByProtocol: {},
    routeHealthByRoute: {},
    routeOperatorByRoute: {},
    executionPolicyByRoute: {},
    incidentHistory: [],
    routeOperationHistory: [],
    executionPolicyHistory: [],
    routeHistory: [],
    alertCooldowns: {},
    lastProtocolIncident: null,
    lastRouteOperation: null,
    lastExecutionPolicyDecision: null
  };
}

function buildScenarioPayload(scenario) {
  const basePayload = {
    route: 'hbtc_to_btc_l1',
    protocol: 'hermetica'
  };

  if (scenario === 'incident') {
    return {
      ...basePayload,
      functionName: 'request-redeem',
      errorCode: 'u101008',
      errorName: 'ERR_NOT_PROTOCOL',
      context: {
        hqProtocolState: {
          'vault-hbtc-v1': false,
          'state-hbtc-v1': true,
          'protocol-enabled': true
        }
      }
    };
  }

  return basePayload;
}

function applyScenarioState(state, scenario) {
  const nextState = {
    ...state,
    protocolHealthByProtocol: {
      ...(state.protocolHealthByProtocol || {})
    },
    routeHealthByRoute: {
      ...(state.routeHealthByRoute || {})
    }
  };

  if (scenario === 'protocol-only-block') {
    nextState.protocolHealthByProtocol.hermetica = {
      status: 'blocked',
      updatedAt: new Date().toISOString(),
      reason: 'manual_protocol_block_for_fallback_test',
      incidentType: 'PROTOCOL_ONLY_BLOCK'
    };

    delete nextState.routeHealthByRoute.hbtc_to_btc_l1;
  }

  return nextState;
}

function printSection(title, data) {
  console.log('');
  console.log('='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
  console.log(JSON.stringify(data, null, 2));
}

function buildCompactSummary(name, incidentResult, routeResult, policyResult) {
  return {
    scenario: name,
    incidentDetected: incidentResult?.incidentDetected || false,
    incidentType: incidentResult?.incidentType || null,
    preferredVariant: policyResult?.preferredVariant || routeResult?.pathVariant || null,
    selectedVariant: policyResult?.selectedVariant || null,
    fallbackApplied: policyResult?.fallbackApplied || false,
    decision: policyResult?.decision || null,
    reason: policyResult?.reason || null
  };
}

function runScenario(name) {
  let state = createBaseState();
  state = applyScenarioState(state, name);

  const payload = buildScenarioPayload(name);

  const incidentResult = invokeSkill(incidentSkill, {
    ...payload,
    state
  });

  if (incidentResult?.statePatch) {
    state = mergeState(state, incidentResult.statePatch);
  }

  const routeResult = invokeSkill(routeOperatorSkill, {
    ...payload,
    state
  });

  if (routeResult?.statePatch) {
    state = mergeState(state, routeResult.statePatch);
  }

  const policyResult = invokeSkill(executionPolicySkill, {
    ...payload,
    state
  });

  if (policyResult?.statePatch) {
    state = mergeState(state, policyResult.statePatch);
  }

  printSection(`SCENARIO: ${name} — INCIDENT`, incidentResult);
  printSection(`SCENARIO: ${name} — ROUTE OPERATOR`, routeResult);
  printSection(`SCENARIO: ${name} — EXECUTION POLICY`, policyResult);

  return {
    name,
    incidentResult,
    routeResult,
    policyResult,
    finalState: state,
    summary: buildCompactSummary(name, incidentResult, routeResult, policyResult)
  };
}

function main() {
  const scenarios = [
    'normal',
    'protocol-only-block',
    'incident'
  ];

  const results = scenarios.map(runScenario);
  const summary = results.map((item) => item.summary);

  printSection('FINAL SUMMARY', summary);

  console.log('');
  console.log('OK: run-agent-scenarios finalizado');
}

main();