'use strict';

const assert = require('assert');
const { buildDecision, run } = require('../skills/execution-readiness-guard/index.cjs');

function isoOffset(baseTs, offsetMs) {
  return new Date(baseTs + offsetMs).toISOString();
}

function main() {
  const baseTs = Date.parse('2026-03-25T21:00:00.000Z');

  const upstreamAllow = {
    route: 'hbtc_to_btc_l1',
    preferredVariant: 'direct_redeem',
    selectedVariant: 'direct_redeem',
    decision: 'ALLOW',
    reason: 'EXECUTION_POLICY_CLEAR'
  };

  const upstreamBlocked = {
    route: 'hbtc_to_btc_l1',
    preferredVariant: 'direct_redeem',
    selectedVariant: 'direct_redeem',
    decision: 'BLOCK',
    reason: 'ROUTE_HEALTH_BLOCKED'
  };

  {
    const state = {
      executionReadinessHistory: []
    };

    const decision = buildDecision(state, {
      now: isoOffset(baseTs, 0),
      executionPolicyDecision: upstreamAllow
    });

    assert.equal(decision.decision, 'ALLOW');
    assert.equal(decision.reason, 'EXECUTION_READY');
  }

  {
    const state = {
      executionReadinessHistory: []
    };

    const decision = buildDecision(state, {
      now: isoOffset(baseTs, 0),
      executionPolicyDecision: upstreamBlocked
    });

    assert.equal(decision.decision, 'BLOCK');
    assert.equal(decision.reason, 'UPSTREAM_DECISION_NOT_ALLOW');
  }

  {
    const state = {
      executionReadinessHistory: [
        {
          route: 'hbtc_to_btc_l1',
          selectedVariant: 'direct_redeem',
          decision: 'ALLOW',
          decidedAt: isoOffset(baseTs, -30 * 1000)
        }
      ]
    };

    const decision = buildDecision(state, {
      now: isoOffset(baseTs, 0),
      executionPolicyDecision: upstreamAllow,
      executionReadinessConfig: {
        duplicateWindowMs: 2 * 60 * 1000,
        cooldownMs: 10 * 60 * 1000,
        frequencyWindowMs: 60 * 60 * 1000,
        maxExecutionsPerWindow: 3
      }
    });

    assert.equal(decision.decision, 'BLOCK');
    assert.equal(decision.reason, 'DUPLICATE_ROUTE_VARIANT_WINDOW_ACTIVE');
  }

  {
    const state = {
      executionReadinessHistory: [
        {
          route: 'hbtc_to_btc_l1',
          selectedVariant: 'fallback_redeem',
          decision: 'ALLOW',
          decidedAt: isoOffset(baseTs, -5 * 60 * 1000)
        }
      ]
    };

    const decision = buildDecision(state, {
      now: isoOffset(baseTs, 0),
      executionPolicyDecision: {
        ...upstreamAllow,
        selectedVariant: 'direct_redeem'
      },
      executionReadinessConfig: {
        duplicateWindowMs: 2 * 60 * 1000,
        cooldownMs: 10 * 60 * 1000,
        frequencyWindowMs: 60 * 60 * 1000,
        maxExecutionsPerWindow: 3
      }
    });

    assert.equal(decision.decision, 'BLOCK');
    assert.equal(decision.reason, 'ROUTE_COOLDOWN_ACTIVE');
  }

  {
    const state = {
      executionReadinessHistory: [
        {
          route: 'hbtc_to_btc_l1',
          selectedVariant: 'variant_a',
          decision: 'ALLOW',
          decidedAt: isoOffset(baseTs, -50 * 60 * 1000)
        },
        {
          route: 'hbtc_to_btc_l1',
          selectedVariant: 'variant_b',
          decision: 'ALLOW',
          decidedAt: isoOffset(baseTs, -40 * 60 * 1000)
        },
        {
          route: 'hbtc_to_btc_l1',
          selectedVariant: 'variant_c',
          decision: 'ALLOW',
          decidedAt: isoOffset(baseTs, -20 * 60 * 1000)
        }
      ]
    };

    const decision = buildDecision(state, {
      now: isoOffset(baseTs, 0),
      executionPolicyDecision: {
        ...upstreamAllow,
        selectedVariant: 'direct_redeem'
      },
      executionReadinessConfig: {
        duplicateWindowMs: 2 * 60 * 1000,
        cooldownMs: 1 * 60 * 1000,
        frequencyWindowMs: 60 * 60 * 1000,
        maxExecutionsPerWindow: 3
      }
    });

    assert.equal(decision.decision, 'BLOCK');
    assert.equal(decision.reason, 'EXECUTION_FREQUENCY_LIMIT_REACHED');
  }

  {
    const state = {
      executionReadinessByRoute: {},
      executionReadinessHistory: []
    };

    const result = run({
      state,
      now: isoOffset(baseTs, 0),
      executionPolicyDecision: upstreamAllow
    });

    assert.equal(result.ok, true);
    assert.equal(result.skillId, 'execution-readiness-guard');
    assert.equal(result.decision, 'ALLOW');
    assert.equal(result.reason, 'EXECUTION_READY');
    assert.ok(result.statePatch);
    assert.ok(result.statePatch.executionReadinessByRoute);
    assert.ok(result.statePatch.lastExecutionReadinessDecision);
    assert.ok(Array.isArray(result.statePatch.executionReadinessHistory));
    assert.equal(result.statePatch.executionReadinessHistory.length, 1);
  }

  console.log('OK: test-execution-readiness-guard passou');
}

main();