'use strict';

function isObject(value) {
  return typeof value === 'object' && value !== null;
}

function buildUnknown(reason) {
  return {
    readiness: 'unknown',
    eligible: false,
    reason
  };
}

function buildDecision(state, route) {
  const routeOperator = state?.routeOperatorByRoute?.[route] ?? null;
  const routeHealth = state?.routeHealthByRoute?.[route] ?? null;
  const routeScore = state?.routeScoreByRoute?.[route] ?? null;

  if (!routeOperator) {
    return buildUnknown('MISSING_ROUTE_OPERATOR');
  }

  if (!routeHealth) {
    return buildUnknown('MISSING_ROUTE_HEALTH');
  }

  if (!routeScore) {
    return buildUnknown('MISSING_ROUTE_SCORE');
  }

  const protocol = routeOperator?.protocol ?? null;

  if (!protocol || !String(protocol).trim()) {
    return buildUnknown('MISSING_PROTOCOL_REFERENCE');
  }

  const protocolHealth = state?.protocolHealthByProtocol?.[protocol] ?? null;

  if (!protocolHealth) {
    return buildUnknown('MISSING_PROTOCOL_HEALTH');
  }

  if (routeOperator?.decision === 'BLOCK') {
    return {
      readiness: 'blocked',
      eligible: false,
      reason: routeOperator?.reason || 'ROUTE_OPERATOR_BLOCKED'
    };
  }

  if (routeHealth?.status === 'blocked') {
    return {
      readiness: 'blocked',
      eligible: false,
      reason: routeHealth?.reason || 'ROUTE_HEALTH_BLOCKED'
    };
  }

  if (protocolHealth?.status === 'blocked') {
    return {
      readiness: 'blocked',
      eligible: false,
      reason: protocolHealth?.reason || 'PROTOCOL_BLOCKED'
    };
  }

  if (routeScore?.status === 'degraded') {
    return {
      readiness: 'degraded',
      eligible: false,
      reason: routeScore?.reason || 'ROUTE_SCORE_DEGRADED'
    };
  }

  return {
    readiness: 'ready',
    eligible: true,
    reason: 'EXECUTION_READY'
  };
}

function buildResultOk(route, decision) {
  return {
    ok: true,
    skill: 'execution-readiness-guard',
    route,
    readiness: decision.readiness,
    eligible: decision.eligible,
    reason: decision.reason
  };
}

function buildResultError(error) {
  return {
    ok: false,
    skill: 'execution-readiness-guard',
    error
  };
}

function run(payload) {
  if (!isObject(payload)) {
    return buildResultError('INVALID_INPUT');
  }

  const route = payload.route;

  if (typeof route !== 'string' || !route.trim()) {
    return buildResultError('MISSING_ROUTE');
  }

  if (!isObject(payload.state)) {
    return buildResultError('INVALID_STATE');
  }

  const decision = buildDecision(payload.state, route);
  return buildResultOk(route, decision);
}

module.exports = {
  run,
  buildDecision,
  buildResultError,
  buildResultOk
};
