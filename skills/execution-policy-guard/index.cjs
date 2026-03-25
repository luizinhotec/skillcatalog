'use strict';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function resolveState(input) {
  return (
    input?.state ||
    input?.context?.state ||
    input?.context?.skillState ||
    input?.context?.currentState ||
    input?.context?.consolidatedState ||
    {}
  );
}

function normalizeVariant(variant) {
  if (!variant) {
    return null;
  }

  return {
    pathVariant: variant.pathVariant || variant.id || null,
    priority: variant.priority || null,
    protocol: variant.protocol || null,
    operation: variant.operation || null,
    assetIn: variant.assetIn || null,
    assetOut: variant.assetOut || null,
    enabled: variant.enabled !== false
  };
}

function getAvailableVariants(state, route) {
  const routeOperator = state?.routeOperatorByRoute?.[route] || null;
  const lastRouteOperation = state?.lastRouteOperation || null;

  if (
    routeOperator?.availableVariants &&
    Array.isArray(routeOperator.availableVariants) &&
    routeOperator.availableVariants.length > 0
  ) {
    return routeOperator.availableVariants
      .map(normalizeVariant)
      .filter(Boolean)
      .sort((a, b) => (a.priority || 999) - (b.priority || 999));
  }

  if (
    lastRouteOperation?.route === route &&
    Array.isArray(lastRouteOperation?.availableVariants) &&
    lastRouteOperation.availableVariants.length > 0
  ) {
    return lastRouteOperation.availableVariants
      .map(normalizeVariant)
      .filter(Boolean)
      .sort((a, b) => (a.priority || 999) - (b.priority || 999));
  }

  return [];
}

function findPreferredVariant(routeOperator, lastRouteOperation, availableVariants) {
  const preferredVariantId =
    routeOperator?.pathVariant ||
    (lastRouteOperation?.route ? lastRouteOperation?.pathVariant : null) ||
    null;

  const preferredVariantPriority =
    routeOperator?.variantPriority ||
    (lastRouteOperation?.route ? lastRouteOperation?.variantPriority : null) ||
    null;

  if (preferredVariantId) {
    const matched = availableVariants.find(
      (variant) => variant.pathVariant === preferredVariantId
    );

    if (matched) {
      return matched;
    }
  }

  if (preferredVariantPriority != null) {
    const matched = availableVariants.find(
      (variant) => variant.priority === preferredVariantPriority
    );

    if (matched) {
      return matched;
    }
  }

  return availableVariants[0] || null;
}

function isVariantProtocolBlocked(state, variant) {
  if (!variant?.protocol) {
    return false;
  }

  const protocolHealth = state?.protocolHealthByProtocol?.[variant.protocol] || null;
  return protocolHealth?.status === 'blocked';
}

function buildDecision(state, route, protocol) {
  const routeOperator = state?.routeOperatorByRoute?.[route] || null;
  const routeHealth = state?.routeHealthByRoute?.[route] || null;
  const lastRouteOperation =
    state?.lastRouteOperation?.route === route ? state.lastRouteOperation : null;

  const availableVariants = getAvailableVariants(state, route);
  const preferredVariant = findPreferredVariant(
    routeOperator,
    lastRouteOperation,
    availableVariants
  );

  if (routeHealth?.status === 'blocked') {
    return {
      decision: 'BLOCK',
      reason: 'ROUTE_HEALTH_BLOCKED',
      preferredVariant: preferredVariant?.pathVariant || null,
      preferredVariantPriority: preferredVariant?.priority || null,
      selectedVariant: null,
      selectedVariantPriority: null,
      fallbackApplied: false,
      fallbackFromVariant: null,
      fallbackToVariant: null
    };
  }

  if (!preferredVariant && availableVariants.length === 0) {
    return {
      decision: 'BLOCK',
      reason: 'NO_ROUTE_VARIANT_AVAILABLE',
      preferredVariant: null,
      preferredVariantPriority: null,
      selectedVariant: null,
      selectedVariantPriority: null,
      fallbackApplied: false,
      fallbackFromVariant: null,
      fallbackToVariant: null
    };
  }

  const effectivePreferredVariant = preferredVariant || {
    pathVariant: null,
    priority: null,
    protocol: protocol || null
  };

  if (!isVariantProtocolBlocked(state, effectivePreferredVariant)) {
    return {
      decision: 'ALLOW',
      reason: 'EXECUTION_POLICY_CLEAR',
      preferredVariant: effectivePreferredVariant.pathVariant || null,
      preferredVariantPriority: effectivePreferredVariant.priority || null,
      selectedVariant: effectivePreferredVariant.pathVariant || null,
      selectedVariantPriority: effectivePreferredVariant.priority || null,
      fallbackApplied: false,
      fallbackFromVariant: null,
      fallbackToVariant: null
    };
  }

  const fallbackVariant = availableVariants.find((variant) => {
    if (!variant?.pathVariant) {
      return false;
    }

    if (variant.pathVariant === effectivePreferredVariant.pathVariant) {
      return false;
    }

    if (variant.enabled === false) {
      return false;
    }

    if (isVariantProtocolBlocked(state, variant)) {
      return false;
    }

    return true;
  });

  if (fallbackVariant) {
    return {
      decision: 'ALLOW',
      reason: 'EXECUTION_POLICY_FALLBACK_APPLIED',
      preferredVariant: effectivePreferredVariant.pathVariant || null,
      preferredVariantPriority: effectivePreferredVariant.priority || null,
      selectedVariant: fallbackVariant.pathVariant || null,
      selectedVariantPriority: fallbackVariant.priority || null,
      fallbackApplied: true,
      fallbackFromVariant: effectivePreferredVariant.pathVariant || null,
      fallbackToVariant: fallbackVariant.pathVariant || null
    };
  }

  return {
    decision: 'BLOCK',
    reason: 'NO_ELIGIBLE_ROUTE_VARIANT',
    preferredVariant: effectivePreferredVariant.pathVariant || null,
    preferredVariantPriority: effectivePreferredVariant.priority || null,
    selectedVariant: null,
    selectedVariantPriority: null,
    fallbackApplied: false,
    fallbackFromVariant: null,
    fallbackToVariant: null
  };
}

function run(input = {}) {
  const state = resolveState(input);
  const route = input?.route || 'hbtc_to_btc_l1';
  const protocol = input?.protocol || 'hermetica';
  const decidedAt = new Date().toISOString();

  const result = buildDecision(state, route, protocol);

  const policyRecord = {
    route,
    status: result.decision === 'BLOCK' ? 'blocked' : 'clear',
    decision: result.decision,
    reason: result.reason,
    preferredVariant: result.preferredVariant,
    preferredVariantPriority: result.preferredVariantPriority,
    selectedVariant: result.selectedVariant,
    selectedVariantPriority: result.selectedVariantPriority,
    fallbackApplied: result.fallbackApplied,
    fallbackFromVariant: result.fallbackFromVariant,
    fallbackToVariant: result.fallbackToVariant,
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
    ].slice(-50)
  };

  return {
    ok: true,
    skill: 'execution-policy-guard',
    route,
    decision: result.decision,
    reason: result.reason,
    preferredVariant: result.preferredVariant,
    preferredVariantPriority: result.preferredVariantPriority,
    selectedVariant: result.selectedVariant,
    selectedVariantPriority: result.selectedVariantPriority,
    fallbackApplied: result.fallbackApplied,
    fallbackFromVariant: result.fallbackFromVariant,
    fallbackToVariant: result.fallbackToVariant,
    statePatch
  };
}

module.exports = {
  run
};