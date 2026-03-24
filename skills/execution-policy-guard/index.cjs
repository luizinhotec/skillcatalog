'use strict';

function buildDecision(state, route, protocol) {
  const routeOperator = state?.routeOperatorByRoute?.[route] || null;
  const routeHealth = state?.routeHealthByRoute?.[route] || null;
  const protocolHealth = state?.protocolHealthByProtocol?.[protocol] || null;
  const lastRouteOperation = state?.lastRouteOperation || null;

  if (routeOperator?.status === 'blocked') {
    return {
      decision: 'BLOCK',
      reason: 'ROUTE_OPERATOR_BLOCKED'
    };
  }

  if (routeOperator?.decision === 'BLOCK') {
    return {
      decision: 'BLOCK',
      reason: 'ROUTE_OPERATOR_BLOCKED'
    };
  }

  if (lastRouteOperation?.route === route && lastRouteOperation?.decision === 'BLOCK') {
    return {
      decision: 'BLOCK',
      reason: 'ROUTE_OPERATOR_BLOCKED'
    };
  }

  if (routeHealth?.status === 'blocked') {
    return {
      decision: 'BLOCK',
      reason: 'ROUTE_HEALTH_BLOCKED'
    };
  }

  if (protocolHealth?.status === 'blocked') {
    return {
      decision: 'BLOCK',
      reason: 'PROTOCOL_HEALTH_BLOCKED'
    };
  }

  return {
    decision: 'ALLOW',
    reason: 'EXECUTION_POLICY_CLEAR'
  };
}

function run(input) {
  const state = input?.state || {};
  const route = input?.route || 'hbtc_to_btc_l1';
  const protocol = input?.protocol || 'hermetica';
  const decidedAt = new Date().toISOString();

  const result = buildDecision(state, route, protocol);

  const policyRecord = {
    route,
    status: result.decision === 'BLOCK' ? 'blocked' : 'clear',
    decision: result.decision,
    reason: result.reason,
    decidedAt
  };

  const statePatch = {
    executionPolicyByRoute: {
      ...(state.executionPolicyByRoute || {}),
      [route]: policyRecord
    },
    lastExecutionPolicyDecision: policyRecord,
    executionPolicyHistory: [
      ...(state.executionPolicyHistory || []),
      policyRecord
    ]
  };

  return {
    ok: true,
    skill: 'execution-policy-guard',
    route,
    decision: result.decision,
    reason: result.reason,
    statePatch
  };
}

module.exports = {
  run
};