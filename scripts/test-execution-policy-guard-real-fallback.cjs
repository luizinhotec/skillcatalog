'use strict';

const assert = require('assert');
const skill = require('../skills/execution-policy-guard/index.cjs');

function print(title, result) {
  console.log('');
  console.log('='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
  console.log(JSON.stringify(result, null, 2));
}

function testPreferredHealthy() {
  const result = skill.run({
    route: 'hbtc_to_btc_l1',
    state: {
      routeOperatorByRoute: {
        hbtc_to_btc_l1: {
          pathVariant: 'direct_redeem',
          variantPriority: 1,
          availableVariants: [
            { pathVariant: 'direct_redeem', priority: 1, protocol: 'hermetica' },
            { pathVariant: 'bridge_recovery', priority: 2, protocol: 'bridge_x' },
            { pathVariant: 'manual_bridge_fallback', priority: 3, protocol: 'hermetica' }
          ]
        }
      }
    }
  });

  assert.strictEqual(result.decision, 'ALLOW');
  assert.strictEqual(result.reason, 'EXECUTION_POLICY_CLEAR');
  assert.strictEqual(result.selectedVariant, 'direct_redeem');
  assert.strictEqual(result.selectedVariantPriority, 1);
  assert.strictEqual(result.fallbackApplied, false);
  assert.strictEqual(result.fallbackFromVariant, null);
  assert.strictEqual(result.fallbackToVariant, null);

  return result;
}

function testFallbackToBridgeRecovery() {
  const result = skill.run({
    route: 'hbtc_to_btc_l1',
    state: {
      routeOperatorByRoute: {
        hbtc_to_btc_l1: {
          pathVariant: 'direct_redeem',
          variantPriority: 1,
          availableVariants: [
            { pathVariant: 'direct_redeem', priority: 1, protocol: 'hermetica' },
            { pathVariant: 'bridge_recovery', priority: 2, protocol: 'bridge_x' },
            { pathVariant: 'manual_bridge_fallback', priority: 3, protocol: 'hermetica' }
          ]
        }
      },
      protocolHealthByProtocol: {
        hermetica: {
          status: 'blocked',
          reason: 'missing_protocol_role'
        }
      }
    }
  });

  assert.strictEqual(result.decision, 'ALLOW');
  assert.strictEqual(result.reason, 'EXECUTION_POLICY_FALLBACK_APPLIED');
  assert.strictEqual(result.preferredVariant, 'direct_redeem');
  assert.strictEqual(result.preferredVariantPriority, 1);
  assert.strictEqual(result.selectedVariant, 'bridge_recovery');
  assert.strictEqual(result.selectedVariantPriority, 2);
  assert.strictEqual(result.fallbackApplied, true);
  assert.strictEqual(result.fallbackFromVariant, 'direct_redeem');
  assert.strictEqual(result.fallbackToVariant, 'bridge_recovery');

  return result;
}

function testAllVariantsBlocked() {
  const result = skill.run({
    route: 'hbtc_to_btc_l1',
    state: {
      routeOperatorByRoute: {
        hbtc_to_btc_l1: {
          pathVariant: 'direct_redeem',
          variantPriority: 1,
          availableVariants: [
            { pathVariant: 'direct_redeem', priority: 1, protocol: 'hermetica' },
            { pathVariant: 'bridge_recovery', priority: 2, protocol: 'bridge_x' },
            { pathVariant: 'manual_bridge_fallback', priority: 3, protocol: 'hermetica' }
          ]
        }
      },
      protocolHealthByProtocol: {
        hermetica: { status: 'blocked' },
        bridge_x: { status: 'blocked' }
      }
    }
  });

  assert.strictEqual(result.decision, 'BLOCK');
  assert.strictEqual(result.reason, 'NO_ELIGIBLE_ROUTE_VARIANT');
  assert.strictEqual(result.selectedVariant, null);
  assert.strictEqual(result.selectedVariantPriority, null);
  assert.strictEqual(result.fallbackApplied, false);

  return result;
}

function testRouteBlocked() {
  const result = skill.run({
    route: 'hbtc_to_btc_l1',
    state: {
      routeOperatorByRoute: {
        hbtc_to_btc_l1: {
          pathVariant: 'direct_redeem',
          variantPriority: 1,
          availableVariants: [
            { pathVariant: 'direct_redeem', priority: 1, protocol: 'hermetica' },
            { pathVariant: 'bridge_recovery', priority: 2, protocol: 'bridge_x' },
            { pathVariant: 'manual_bridge_fallback', priority: 3, protocol: 'hermetica' }
          ]
        }
      },
      routeHealthByRoute: {
        hbtc_to_btc_l1: {
          status: 'blocked',
          reason: 'route_manually_disabled'
        }
      }
    }
  });

  assert.strictEqual(result.decision, 'BLOCK');
  assert.strictEqual(result.reason, 'ROUTE_HEALTH_BLOCKED');
  assert.strictEqual(result.selectedVariant, null);
  assert.strictEqual(result.selectedVariantPriority, null);
  assert.strictEqual(result.fallbackApplied, false);

  return result;
}

function main() {
  const preferredHealthy = testPreferredHealthy();
  const fallbackApplied = testFallbackToBridgeRecovery();
  const allBlocked = testAllVariantsBlocked();
  const routeBlocked = testRouteBlocked();

  console.log('');
  console.log('OK: test-execution-policy-guard-real-fallback passou');

  print('Preferred variant healthy', preferredHealthy);
  print('Fallback to bridge_recovery', fallbackApplied);
  print('All variants blocked', allBlocked);
  print('Route blocked', routeBlocked);
}

main();