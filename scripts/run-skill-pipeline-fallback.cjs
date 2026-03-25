'use strict';

const incidentSkill = require('../skills/protocol-incident-guard/index.cjs');
const routeOperatorSkill = require('../skills/btc-l1-route-operator/index.cjs');
const executionPolicySkill = require('../skills/execution-policy-guard/index.cjs');

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
    incidentHistory: patch.incidentHistory || base.incidentHistory || [],
    routeOperationHistory: patch.routeOperationHistory || base.routeOperationHistory || [],
    executionPolicyHistory: patch.executionPolicyHistory || base.executionPolicyHistory || []
  };
}

function print(title, data) {
  console.log('');
  console.log('='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
  console.log(JSON.stringify(data, null, 2));
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

function runScenario(title, initialState, payload) {
  console.log('');
  console.log('🔥 SCENARIO:', title);

  let state = { ...initialState };

  // STEP 1 — INCIDENT
  const incidentResult = invokeSkill(incidentSkill, {
    ...payload,
    state
  });

  if (incidentResult?.statePatch) {
    state = mergeState(state, incidentResult.statePatch);
  }

  print('STEP 1 — INCIDENT RESULT', incidentResult);

  // STEP 2 — ROUTE OPERATOR
  const routeResult = invokeSkill(routeOperatorSkill, {
    ...payload,
    state
  });

  if (routeResult?.statePatch) {
    state = mergeState(state, routeResult.statePatch);
  }

  print('STEP 2 — ROUTE OPERATOR RESULT', routeResult);

  // STEP 3 — EXECUTION POLICY
  const policyResult = invokeSkill(executionPolicySkill, {
    ...payload,
    state
  });

  if (policyResult?.statePatch) {
    state = mergeState(state, policyResult.statePatch);
  }

  print('STEP 3 — EXECUTION POLICY RESULT', policyResult);

  print('FINAL STATE', state);

  return {
    incidentResult,
    routeResult,
    policyResult,
    finalState: state
  };
}

function main() {
  const baseState = {
    catalogVersion: 1,
    skillStatusById: {},
    protocolHealthByProtocol: {},
    routeHealthByRoute: {},
    routeOperatorByRoute: {},
    executionPolicyByRoute: {},
    incidentHistory: [],
    routeOperationHistory: [],
    executionPolicyHistory: []
  };

  runScenario(
    'Normal execution (no incident)',
    baseState,
    {
      route: 'hbtc_to_btc_l1',
      protocol: 'hermetica'
    }
  );

  runScenario(
    'Protocol incident → fallback attempt',
    baseState,
    {
      route: 'hbtc_to_btc_l1',
      protocol: 'hermetica',
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
    }
  );
}

main();