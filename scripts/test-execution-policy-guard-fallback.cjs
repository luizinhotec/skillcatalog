'use strict';

const assert = require('assert');
const skill = require('../skills/execution-policy-guard/index.cjs');

function runTest(title, input) {
  const result = skill.run(input);

  console.log('');
  console.log('='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
  console.log(JSON.stringify(result, null, 2));

  return result;
}

function testPreferredHealthy() {
  const result = runTest('Preferred variant healthy', {
    route: 'hbtc_to_btc_l1',
    state: {
      routeOperatorByRoute: {
        hbtc_to_btc_l1: {
          pathVariant: 'direct_redeem',
          variantPriority: 1,
          availableVariants: [
            { pathVariant: 'direct_redeem', priority: 1, protocol: 'hermetica' },
            { pathVariant: 'manual_bridge_fallback', priority: 2, protocol: 'hermetica' }
          ]
        }
      }
    }
  });

  assert.strictEqual(result.decision, 'ALLOW');
  assert.strictEqual(result.fallbackApplied, false);
  assert.strictEqual(result.selectedVariant, 'direct_redeem');
}

function testFallbackToSecond() {
  const result = runTest('Fallback to second variant', {
    route: 'hbtc_to_btc_l1',
    state: {
      routeOperatorByRoute: {
        hbtc_to_btc_l1: {
          pathVariant: 'direct_redeem',
          variantPriority: 1,
          availableVariants: [
            { pathVariant: 'direct_redeem', priority: 1, protocol: 'hermetica' },
            { pathVariant: 'manual_bridge_fallback', priority: 2, protocol: 'hermetica' }
          ]
        }
      },
      protocolHealthByProtocol: {
        hermetica: {
          status: 'blocked'
        }
      }
    }
  });

  assert.strictEqual(result.decision, 'BLOCK'); // ambos usam hermetica → tudo bloqueado
}

function testAllBlocked() {
  const result = runTest('All variants blocked', {
    route: 'hbtc_to_btc_l1',
    state: {
      routeOperatorByRoute: {
        hbtc_to_btc_l1: {
          pathVariant: 'direct_redeem',
          variantPriority: 1,
          availableVariants: [
            { pathVariant: 'direct_redeem', priority: 1, protocol: 'hermetica' },
            { pathVariant: 'manual_bridge_fallback', priority: 2, protocol: 'hermetica' }
          ]
        }
      },
      protocolHealthByProtocol: {
        hermetica: {
          status: 'blocked'
        }
      }
    }
  });

  assert.strictEqual(result.decision, 'BLOCK');
}

function testRouteBlocked() {
  const result = runTest('Route blocked', {
    route: 'hbtc_to_btc_l1',
    state: {
      routeHealthByRoute: {
        hbtc_to_btc_l1: {
          status: 'blocked'
        }
      }
    }
  });

  assert.strictEqual(result.decision, 'BLOCK');
}

function main() {
  testPreferredHealthy();
  testFallbackToSecond();
  testAllBlocked();
  testRouteBlocked();

  console.log('');
  console.log('OK: execution-policy fallback tests passaram');
}

main();