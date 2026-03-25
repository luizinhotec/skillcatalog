'use strict';

const incidentSkill = require('../skills/protocol-incident-guard/index.cjs');
const routeOperatorSkill = require('../skills/btc-l1-route-operator/index.cjs');
const executionPolicySkill = require('../skills/execution-policy-guard/index.cjs');
const { readState, writeState } = require('../lib/skill-state-store.cjs');

function parseArgs(argv) {
  const args = {
    route: 'hbtc_to_btc_l1',
    protocol: 'hermetica',
    intervalSeconds: 10,
    maxIterations: 0,
    scenario: 'normal',
    resetHealth: false
  };

  for (const rawArg of argv) {
    if (!rawArg.startsWith('--')) {
      continue;
    }

    const eqIndex = rawArg.indexOf('=');
    const key = eqIndex >= 0 ? rawArg.slice(2, eqIndex) : rawArg.slice(2);
    const value = eqIndex >= 0 ? rawArg.slice(eqIndex + 1) : 'true';

    if (key === 'route') {
      args.route = value;
    } else if (key === 'protocol') {
      args.protocol = value;
    } else if (key === 'interval-seconds') {
      args.intervalSeconds = Number(value) || 10;
    } else if (key === 'max-iterations') {
      args.maxIterations = Number(value) || 0;
    } else if (key === 'scenario') {
      args.scenario = value;
    } else if (key === 'reset-health') {
      args.resetHealth = value === 'true';
    }
  }

  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function buildScenarioPayload(args) {
  const basePayload = {
    route: args.route,
    protocol: args.protocol
  };

  if (args.scenario === 'incident') {
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

function ensureBaseState(state) {
  return {
    catalogVersion: state?.catalogVersion || 1,
    skillStatusById: state?.skillStatusById || {},
    protocolHealthByProtocol: state?.protocolHealthByProtocol || {},
    routeHealthByRoute: state?.routeHealthByRoute || {},
    routeOperatorByRoute: state?.routeOperatorByRoute || {},
    executionPolicyByRoute: state?.executionPolicyByRoute || {},
    incidentHistory: ensureArray(state?.incidentHistory),
    routeOperationHistory: ensureArray(state?.routeOperationHistory),
    executionPolicyHistory: ensureArray(state?.executionPolicyHistory),
    routeHistory: ensureArray(state?.routeHistory),
    alertCooldowns: state?.alertCooldowns || {},
    lastProtocolIncident: state?.lastProtocolIncident || null,
    lastRouteOperation: state?.lastRouteOperation || null,
    lastExecutionPolicyDecision: state?.lastExecutionPolicyDecision || null
  };
}

function resetHealthForRoute(state, route, protocol) {
  const nextState = {
    ...state,
    protocolHealthByProtocol: {
      ...(state.protocolHealthByProtocol || {})
    },
    routeHealthByRoute: {
      ...(state.routeHealthByRoute || {})
    }
  };

  delete nextState.routeHealthByRoute[route];
  delete nextState.protocolHealthByProtocol[protocol];

  return nextState;
}

function applyScenarioState(state, args) {
  const nextState = {
    ...state,
    protocolHealthByProtocol: {
      ...(state.protocolHealthByProtocol || {})
    },
    routeHealthByRoute: {
      ...(state.routeHealthByRoute || {})
    }
  };

  if (args.scenario === 'protocol-only-block') {
    nextState.protocolHealthByProtocol[args.protocol] = {
      status: 'blocked',
      updatedAt: new Date().toISOString(),
      reason: 'manual_protocol_block_for_fallback_test',
      incidentType: 'PROTOCOL_ONLY_BLOCK'
    };

    delete nextState.routeHealthByRoute[args.route];
  }

  return nextState;
}

function printSummary(iteration, scenario, incidentResult, routeResult, policyResult) {
  console.log('');
  console.log('='.repeat(80));
  console.log(`ITERATION ${iteration} | scenario=${scenario}`);
  console.log('='.repeat(80));

  console.log(JSON.stringify({
    incidentDetected: incidentResult?.incidentDetected || false,
    incidentType: incidentResult?.incidentType || null,
    route: routeResult?.route || null,
    preferredVariant: policyResult?.preferredVariant || routeResult?.pathVariant || null,
    selectedVariant: policyResult?.selectedVariant || null,
    fallbackApplied: policyResult?.fallbackApplied || false,
    decision: policyResult?.decision || null,
    reason: policyResult?.reason || null
  }, null, 2));
}

async function runLoop() {
  const args = parseArgs(process.argv.slice(2));
  let iteration = 0;

  while (true) {
    iteration += 1;

    let state = ensureBaseState(readState());

    if (args.resetHealth) {
      state = resetHealthForRoute(state, args.route, args.protocol);
    }

    state = applyScenarioState(state, args);

    const payload = buildScenarioPayload(args);

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

    writeState(state);

    printSummary(
      iteration,
      args.scenario,
      incidentResult,
      routeResult,
      policyResult
    );

    if (args.maxIterations > 0 && iteration >= args.maxIterations) {
      console.log('');
      console.log(`Loop finalizado após ${iteration} iteração(ões).`);
      break;
    }

    await sleep(args.intervalSeconds * 1000);
  }
}

runLoop().catch((error) => {
  console.error('');
  console.error('ERRO NO LOOP DO AGENTE');
  console.error(error);
  process.exit(1);
});