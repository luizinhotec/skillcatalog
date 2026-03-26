'use strict';

function buildDecision(state, route) {
  const routeOperator = state?.routeOperatorByRoute?.[route] || null;
  const routeHealth = state?.routeHealthByRoute?.[route] || null;
  const protocol = routeOperator?.protocol || null;
  const protocolHealth = protocol ? (state?.protocolHealthByProtocol?.[protocol] || null) : null;
  const routeScore = state?.routeScoreByRoute?.[route] || null;

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

function run(payload) {
  const state = payload?.state || {};
  const route = payload?.route || null;

  if (!route) {
    return {
      ok: false,
      error: 'MISSING_ROUTE'
    };
  }

  const decision = buildDecision(state, route);
  const decidedAt = new Date().toISOString();

  const result = {
    ok: true,
    skillId: 'execution-readiness-guard',
    route,
    readiness: decision.readiness,
    eligible: decision.eligible,
    reason: decision.reason,
    decidedAt,
    statePatch: {
      executionReadinessByRoute: {
        [route]: {
          readiness: decision.readiness,
          eligible: decision.eligible,
          reason: decision.reason,
          updatedAt: decidedAt
        }
      },
      lastExecutionReadinessDecision: {
        route,
        readiness: decision.readiness,
        eligible: decision.eligible,
        reason: decision.reason,
        decidedAt
      },
      executionReadinessHistory: [
        {
          route,
          readiness: decision.readiness,
          eligible: decision.eligible,
          reason: decision.reason,
          decidedAt
        }
      ]
    }
  };

  return result;
}

module.exports = {
  run,
  buildDecision
};