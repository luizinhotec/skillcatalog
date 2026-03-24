'use strict';

const fs = require('fs');
const path = require('path');

const { readState, writeState } = require('../lib/skill-state-store.cjs');

const skill2 = require('../skills/protocol-incident-guard/index.cjs');
const skill1 = require('../skills/btc-l1-route-operator/index.cjs');
const skill3 = require('../skills/execution-policy-guard/index.cjs');

const statePath = path.resolve(__dirname, '../state/skill-state.json');

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function applyPatch(state, patch) {
  if (!isObject(patch)) return state;

  for (const [k, v] of Object.entries(patch)) {
    if (Array.isArray(v)) {
      state[k] = clone(v);
    } else if (isObject(v)) {
      if (!isObject(state[k])) state[k] = {};
      applyPatch(state[k], v);
    } else {
      state[k] = v;
    }
  }

  return state;
}

function getFn(mod) {
  return (
    mod.run ||
    mod.execute ||
    mod.process ||
    mod.handle ||
    mod.evaluate ||
    mod.detect ||
    mod.resolve ||
    mod.decide ||
    (typeof mod === 'function' ? mod : null)
  );
}

function extractPatch(res, skillName) {
  if (!res || typeof res !== 'object') {
    throw new Error(`${skillName} não retornou objeto`);
  }

  if (!res.statePatch || typeof res.statePatch !== 'object') {
    throw new Error(`${skillName} não retornou statePatch`);
  }

  return res.statePatch;
}

function cleanState() {
  return {
    catalogVersion: 1,
    skillStatusById: {},
    protocolHealthByProtocol: {},
    routeHealthByRoute: {},
    incidentHistory: [],
    routeOperatorByRoute: {},
    routeOperationHistory: [],
    executionPolicyByRoute: {},
    executionPolicyHistory: []
  };
}

function buildSharedContext(state) {
  return {
    state,
    skillState: state,
    currentState: state,
    consolidatedState: state
  };
}

function main() {
  const original = fs.existsSync(statePath) ? clone(readState()) : null;

  const run2 = getFn(skill2);
  const run1 = getFn(skill1);
  const run3 = getFn(skill3);

  if (!run2) throw new Error('protocol-incident-guard sem função executável');
  if (!run1) throw new Error('btc-l1-route-operator sem função executável');
  if (!run3) throw new Error('execution-policy-guard sem função executável');

  let state = cleanState();

  try {
    writeState(clone(state));

    // =========================
    // SKILL 2 — INCIDENT
    // =========================
    const res2 = run2({
      protocol: 'hermetica',
      functionName: 'request-redeem',
      errorCode: 'u101008',
      errorName: 'ERR_NOT_PROTOCOL',
      routeHint: 'hbtc_to_btc_l1',
      contract: 'vault-hbtc-v1',
      txid: null,
      context: {
        ...buildSharedContext(state),
        hqProtocolState: {
          'vault-hbtc-v1': false,
          'state-hbtc-v1': true,
          'protocol-enabled': true
        }
      }
    });

    applyPatch(state, extractPatch(res2, 'protocol-incident-guard'));

    // =========================
    // SKILL 1 — ROUTE
    // =========================
    const res1 = run1({
      route: 'hbtc_to_btc_l1',
      protocol: 'hermetica',
      operation: 'redeem_to_btc_l1',
      assetIn: 'hbtc',
      assetOut: 'btc_l1',
      context: buildSharedContext(state)
    });

    applyPatch(state, extractPatch(res1, 'btc-l1-route-operator'));

    // =========================
    // SKILL 3 — POLICY
    // =========================
    const res3 = run3({
      route: 'hbtc_to_btc_l1',
      protocol: 'hermetica',
      operation: 'redeem_to_btc_l1',
      assetIn: 'hbtc',
      assetOut: 'btc_l1',

      routeOperator: state.routeOperatorByRoute?.hbtc_to_btc_l1 || null,
      routeHealth: state.routeHealthByRoute?.hbtc_to_btc_l1 || null,
      protocolHealth: state.protocolHealthByProtocol?.hermetica || null,
      lastRouteOperation: state.lastRouteOperation || null,
      lastProtocolIncident: state.lastProtocolIncident || null,

      context: buildSharedContext(state)
    });

    applyPatch(state, extractPatch(res3, 'execution-policy-guard'));

    writeState(state);

    console.log(JSON.stringify({
      ok: true,
      pipeline: [
        'protocol-incident-guard',
        'btc-l1-route-operator',
        'execution-policy-guard'
      ],
      incidentDetected: !!state.lastProtocolIncident,
      incidentType: state.lastProtocolIncident?.type || null,
      route: state.lastRouteOperation?.route || 'hbtc_to_btc_l1',
      pathVariant: state.lastRouteOperation?.pathVariant || null,
      decision: state.lastExecutionPolicyDecision?.decision || null,
      reason: state.lastExecutionPolicyDecision?.reason || null,
      stateSummary: {
        protocolHealth: state.protocolHealthByProtocol?.hermetica || null,
        routeHealth: state.routeHealthByRoute?.hbtc_to_btc_l1 || null,
        lastProtocolIncident: state.lastProtocolIncident || null,
        lastRouteOperation: state.lastRouteOperation || null,
        lastExecutionPolicyDecision: state.lastExecutionPolicyDecision || null
      }
    }, null, 2));
  } finally {
    if (original) {
      writeState(original);
    } else if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }
  }
}

main();