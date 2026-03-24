'use strict';

const ROUTE_DEFINITIONS = {
  hbtc_to_btc_l1: {
    variants: [
      {
        id: 'direct_redeem',
        priority: 1,
        enabled: true,
        protocol: 'hermetica',
        operation: 'redeem_to_btc_l1',
        assetIn: 'hbtc',
        assetOut: 'btc_l1'
      },
      {
        id: 'manual_bridge_fallback',
        priority: 2,
        enabled: true,
        protocol: 'hermetica',
        operation: 'manual_recovery_to_btc_l1',
        assetIn: 'hbtc',
        assetOut: 'btc_l1'
      }
    ]
  },
  sbtc_to_btc_l1: {
    variants: [
      {
        id: 'direct_redeem',
        priority: 1,
        enabled: true,
        protocol: 'stacks',
        operation: 'redeem_to_btc_l1',
        assetIn: 'sbtc',
        assetOut: 'btc_l1'
      }
    ]
  },
  btc_l1_to_sbtc: {
    variants: [
      {
        id: 'direct_mint',
        priority: 1,
        enabled: true,
        protocol: 'stacks',
        operation: 'mint_from_btc_l1',
        assetIn: 'btc_l1',
        assetOut: 'sbtc'
      }
    ]
  },
  btc_l1_to_sbtc_to_usdcx: {
    variants: [
      {
        id: 'mint_then_swap',
        priority: 1,
        enabled: true,
        protocol: 'stacks',
        operation: 'mint_and_swap',
        assetIn: 'btc_l1',
        assetOut: 'usdcx'
      }
    ]
  }
};

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function resolveRouteVariant(routeDefinition) {
  const variants = ensureArray(routeDefinition?.variants)
    .filter((variant) => variant && variant.enabled !== false)
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));

  return variants[0] || null;
}

function buildStatePatch(result, previousState = {}) {
  const route = result?.route;
  if (!route) {
    return {};
  }

  const status =
    result.decision === 'BLOCK'
      ? 'blocked'
      : result.decision === 'HOLD'
        ? 'hold'
        : 'ready';

  const routeOperatorByRoute = {
    ...(previousState?.routeOperatorByRoute || {}),
    [route]: {
      status,
      updatedAt: result.detectedAt,
      decision: result.decision,
      reason: result.reason,
      protocol: result.protocol || null,
      operation: result.operation || null,
      assetIn: result.assetIn || null,
      assetOut: result.assetOut || null,
      pathVariant: result.pathVariant || null,
      variantPriority: result.variantPriority || null,
      blockingSource: result.blockingSource || null,
      blockingHealthReason: result.blockingHealthReason || null,
      incidentType: result.incidentType || null
    }
  };

  const historyEntry = {
    route: result.route,
    protocol: result.protocol || null,
    operation: result.operation || null,
    assetIn: result.assetIn || null,
    assetOut: result.assetOut || null,
    pathVariant: result.pathVariant || null,
    variantPriority: result.variantPriority || null,
    decision: result.decision,
    reason: result.reason,
    blockingSource: result.blockingSource || null,
    blockingHealthReason: result.blockingHealthReason || null,
    incidentType: result.incidentType || null,
    detectedAt: result.detectedAt
  };

  return {
    routeOperatorByRoute,
    lastRouteOperation: historyEntry,
    routeOperationHistory: [
      ...ensureArray(previousState?.routeOperationHistory),
      historyEntry
    ].slice(-50)
  };
}

function evaluate(payload = {}) {
  const state = payload?.state || payload?.context?.state || {};
  const route = payload?.route || payload?.routeId || 'hbtc_to_btc_l1';
  const routeDefinition = ROUTE_DEFINITIONS[route] || null;
  const detectedAt = new Date().toISOString();

  if (!routeDefinition) {
    return null;
  }

  const selectedVariant = resolveRouteVariant(routeDefinition);

  if (!selectedVariant) {
    return {
      type: 'BTC_L1_ROUTE_OPERATION',
      skill: 'btc-l1-route-operator',
      route,
      protocol: null,
      operation: null,
      assetIn: null,
      assetOut: null,
      pathVariant: null,
      variantPriority: null,
      decision: 'BLOCK',
      severity: 'high',
      reason: 'NO_ROUTE_VARIANT_AVAILABLE',
      blockingSource: 'routeDefinition',
      blockingStatus: 'missing_variant',
      blockingUpdatedAt: null,
      blockingHealthReason: 'no_enabled_variant',
      incidentType: null,
      detectedAt,
      statePatch: buildStatePatch({
        route,
        protocol: null,
        operation: null,
        assetIn: null,
        assetOut: null,
        pathVariant: null,
        variantPriority: null,
        decision: 'BLOCK',
        reason: 'NO_ROUTE_VARIANT_AVAILABLE',
        blockingSource: 'routeDefinition',
        blockingHealthReason: 'no_enabled_variant',
        incidentType: null,
        detectedAt
      }, state)
    };
  }

  const protocol = selectedVariant.protocol;
  const routeHealth = state?.routeHealthByRoute?.[route] || null;
  const protocolHealth = state?.protocolHealthByProtocol?.[protocol] || null;
  const lastIncident = state?.lastProtocolIncident || null;

  let result;

  if (routeHealth?.status === 'blocked') {
    result = {
      type: 'BTC_L1_ROUTE_OPERATION',
      skill: 'btc-l1-route-operator',
      route,
      protocol,
      operation: selectedVariant.operation,
      assetIn: selectedVariant.assetIn,
      assetOut: selectedVariant.assetOut,
      pathVariant: selectedVariant.id,
      variantPriority: selectedVariant.priority,
      decision: 'BLOCK',
      severity: 'high',
      reason: 'ROUTE_HEALTH_BLOCKED',
      blockingSource: 'routeHealthByRoute',
      blockingStatus: routeHealth?.status || null,
      blockingUpdatedAt: routeHealth?.updatedAt || null,
      blockingHealthReason: routeHealth?.reason || null,
      incidentType: routeHealth?.incidentType || lastIncident?.type || null,
      detectedAt
    };
  } else if (protocolHealth?.status === 'blocked') {
    result = {
      type: 'BTC_L1_ROUTE_OPERATION',
      skill: 'btc-l1-route-operator',
      route,
      protocol,
      operation: selectedVariant.operation,
      assetIn: selectedVariant.assetIn,
      assetOut: selectedVariant.assetOut,
      pathVariant: selectedVariant.id,
      variantPriority: selectedVariant.priority,
      decision: 'BLOCK',
      severity: 'high',
      reason: 'PROTOCOL_HEALTH_BLOCKED',
      blockingSource: 'protocolHealthByProtocol',
      blockingStatus: protocolHealth?.status || null,
      blockingUpdatedAt: protocolHealth?.updatedAt || null,
      blockingHealthReason: protocolHealth?.reason || null,
      incidentType: protocolHealth?.incidentType || lastIncident?.type || null,
      detectedAt
    };
  } else {
    result = {
      type: 'BTC_L1_ROUTE_OPERATION',
      skill: 'btc-l1-route-operator',
      route,
      protocol,
      operation: selectedVariant.operation,
      assetIn: selectedVariant.assetIn,
      assetOut: selectedVariant.assetOut,
      pathVariant: selectedVariant.id,
      variantPriority: selectedVariant.priority,
      decision: 'ALLOW',
      severity: 'info',
      reason: 'ROUTE_CLEAR',
      blockingSource: null,
      blockingStatus: null,
      blockingUpdatedAt: null,
      blockingHealthReason: null,
      incidentType: null,
      detectedAt
    };
  }

  return {
    ...result,
    statePatch: buildStatePatch(result, state)
  };
}

function detect(payload = {}) {
  return evaluate(payload);
}

function operate(payload = {}) {
  return evaluate(payload);
}

module.exports = {
  skillId: 'btc-l1-route-operator',
  ROUTE_DEFINITIONS,
  resolveRouteVariant,
  evaluate,
  detect,
  operate
};