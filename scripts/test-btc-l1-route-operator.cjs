'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { readState, writeState } = require('../lib/skill-state-store.cjs');
const skillModule = require('../skills/btc-l1-route-operator/index.cjs');

const statePath = path.resolve(__dirname, '../state/skill-state.json');

function makeBaseState() {
  return {
    catalogVersion: 1,
    skillStatusById: {
      'btc-l1-route-operator': {
        status: 'active',
        updatedAt: new Date().toISOString()
      }
    },
    protocolHealthByProtocol: {},
    routeHealthByRoute: {},
    routeOperatorByRoute: {},
    lastRouteOperation: null,
    routeOperationHistory: [],
    executionPolicyByRoute: {},
    lastExecutionPolicyDecision: null,
    executionPolicyHistory: [],
    incidentHistory: [],
    lastProtocolIncident: null
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveCallable(mod) {
  if (typeof mod === 'function') {
    return mod;
  }

  const candidates = [
    'operate',
    'run',
    'runSkill',
    'execute',
    'handle',
    'resolve',
    'resolveRoute',
    'resolveRouteOperator',
    'apply',
    'evaluate',
    'detect'
  ];

  for (const key of candidates) {
    if (typeof mod?.[key] === 'function') {
      return mod[key];
    }
  }

  throw new Error(
    'Nenhuma função executável encontrada em skills/btc-l1-route-operator/index.cjs'
  );
}

function applyStatePatch(current, patch) {
  return {
    ...current,
    ...patch,
    routeOperatorByRoute: {
      ...(current.routeOperatorByRoute || {}),
      ...(patch.routeOperatorByRoute || {})
    },
    routeHealthByRoute: {
      ...(current.routeHealthByRoute || {}),
      ...(patch.routeHealthByRoute || {})
    },
    protocolHealthByProtocol: {
      ...(current.protocolHealthByProtocol || {}),
      ...(patch.protocolHealthByProtocol || {})
    },
    executionPolicyByRoute: {
      ...(current.executionPolicyByRoute || {}),
      ...(patch.executionPolicyByRoute || {})
    },
    skillStatusById: {
      ...(current.skillStatusById || {}),
      ...(patch.skillStatusById || {})
    },
    incidentHistory: Array.isArray(patch.incidentHistory)
      ? patch.incidentHistory
      : (current.incidentHistory || []),
    routeOperationHistory: Array.isArray(patch.routeOperationHistory)
      ? patch.routeOperationHistory
      : (current.routeOperationHistory || []),
    executionPolicyHistory: Array.isArray(patch.executionPolicyHistory)
      ? patch.executionPolicyHistory
      : (current.executionPolicyHistory || [])
  };
}

function invokeSkill(fn, payload) {
  const attempts = [
    () => fn(payload),
    () => fn(clone(payload), readState()),
    () => fn({ payload: clone(payload), state: readState() }),
    () => fn({ ...clone(payload), state: readState() })
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const result = attempt();

      if (result?.statePatch) {
        const currentState = readState();
        const nextState = applyStatePatch(currentState, result.statePatch);
        writeState(nextState);
      }

      return result;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function main() {
  const originalStateRaw = fs.readFileSync(statePath, 'utf8');
  const originalState = JSON.parse(originalStateRaw);

  try {
    const baseState = makeBaseState();
    writeState(baseState);

    const runSkill = resolveCallable(skillModule);

    const route = 'hbtc_to_btc_l1';
    const payload = { route };

    const result = invokeSkill(runSkill, payload);
    assert.ok(result, 'a skill não retornou resultado');

    const nextState = readState();

    assert.ok(nextState.routeOperatorByRoute, 'routeOperatorByRoute não foi gravado');

    const resolved = nextState.routeOperatorByRoute[route];
    assert.ok(resolved, `rota ${route} não foi gravada em routeOperatorByRoute`);

    assert.strictEqual(
      resolved.protocol,
      result.protocol,
      'protocol resolvido incorreto'
    );

    assert.strictEqual(
      resolved.operation,
      result.operation,
      'operation resolvida incorreta'
    );

    assert.strictEqual(
      resolved.assetIn,
      result.assetIn,
      'assetIn incorreto'
    );

    assert.strictEqual(
      resolved.assetOut,
      result.assetOut,
      'assetOut incorreto'
    );

    assert.strictEqual(
      resolved.pathVariant,
      result.pathVariant,
      'pathVariant incorreto'
    );

    assert.strictEqual(
      resolved.variantPriority,
      result.variantPriority,
      'variantPriority incorreto'
    );

    assert.ok(
      nextState.lastRouteOperation,
      'lastRouteOperation não foi gravado'
    );

    assert.strictEqual(
      nextState.lastRouteOperation.route,
      route,
      'lastRouteOperation.route incorreto'
    );

    assert.strictEqual(
      nextState.lastRouteOperation.protocol,
      result.protocol,
      'lastRouteOperation.protocol incorreto'
    );

    assert.strictEqual(
      nextState.lastRouteOperation.operation,
      result.operation,
      'lastRouteOperation.operation incorreto'
    );

    assert.strictEqual(
      nextState.lastRouteOperation.assetIn,
      result.assetIn,
      'lastRouteOperation.assetIn incorreto'
    );

    assert.strictEqual(
      nextState.lastRouteOperation.assetOut,
      result.assetOut,
      'lastRouteOperation.assetOut incorreto'
    );

    assert.strictEqual(
      nextState.lastRouteOperation.pathVariant,
      result.pathVariant,
      'lastRouteOperation.pathVariant incorreto'
    );

    assert.strictEqual(
      nextState.lastRouteOperation.variantPriority,
      result.variantPriority,
      'lastRouteOperation.variantPriority incorreto'
    );

    const history = ensureArray(nextState.routeOperationHistory);
    assert.ok(history.length > 0, 'routeOperationHistory não recebeu item');

    const lastHistoryItem = history[history.length - 1];

    assert.strictEqual(
      lastHistoryItem.route,
      route,
      'routeOperationHistory.route incorreto'
    );

    assert.strictEqual(
      lastHistoryItem.protocol,
      result.protocol,
      'routeOperationHistory.protocol incorreto'
    );

    assert.strictEqual(
      lastHistoryItem.operation,
      result.operation,
      'routeOperationHistory.operation incorreto'
    );

    assert.strictEqual(
      lastHistoryItem.assetIn,
      result.assetIn,
      'routeOperationHistory.assetIn incorreto'
    );

    assert.strictEqual(
      lastHistoryItem.assetOut,
      result.assetOut,
      'routeOperationHistory.assetOut incorreto'
    );

    assert.strictEqual(
      lastHistoryItem.pathVariant,
      result.pathVariant,
      'routeOperationHistory.pathVariant incorreto'
    );

    assert.strictEqual(
      lastHistoryItem.variantPriority,
      result.variantPriority,
      'routeOperationHistory.variantPriority incorreto'
    );

    console.log('OK: test-btc-l1-route-operator passou');
    console.log(JSON.stringify({
      route,
      protocol: resolved.protocol,
      operation: resolved.operation,
      assetIn: resolved.assetIn,
      assetOut: resolved.assetOut,
      pathVariant: resolved.pathVariant,
      variantPriority: resolved.variantPriority,
      decision: result.decision,
      historyLength: history.length
    }, null, 2));
  } finally {
    writeState(originalState);
  }
}

main();