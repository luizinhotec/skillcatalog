'use strict';

const assert = require('assert');
const skill = require('../skills/btc-l1-route-operator/index.cjs');

function printResult(title, result) {
  console.log('');
  console.log('='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
  console.log(JSON.stringify(result, null, 2));
}

function testResolveAvailableVariants() {
  const routeDefinition = skill.ROUTE_DEFINITIONS.hbtc_to_btc_l1;
  const variants = skill.resolveAvailableVariants(routeDefinition);

  assert.ok(Array.isArray(variants), 'resolveAvailableVariants deve retornar array');
  assert.strictEqual(variants.length, 3, 'hbtc_to_btc_l1 deve ter 3 variantes disponíveis');

  assert.strictEqual(variants[0].pathVariant, 'direct_redeem');
  assert.strictEqual(variants[0].priority, 1);
  assert.strictEqual(variants[0].protocol, 'hermetica');

  assert.strictEqual(variants[1].pathVariant, 'bridge_recovery');
  assert.strictEqual(variants[1].priority, 2);
  assert.strictEqual(variants[1].protocol, 'bridge_x');

  assert.strictEqual(variants[2].pathVariant, 'manual_bridge_fallback');
  assert.strictEqual(variants[2].priority, 3);
  assert.strictEqual(variants[2].protocol, 'hermetica');

  return variants;
}

function testEvaluateHealthyRoute() {
  const result = skill.evaluate({
    route: 'hbtc_to_btc_l1',
    state: {}
  });

  assert.ok(result, 'evaluate deve retornar resultado');
  assert.strictEqual(result.skill, 'btc-l1-route-operator');
  assert.strictEqual(result.route, 'hbtc_to_btc_l1');
  assert.strictEqual(result.decision, 'ALLOW');
  assert.strictEqual(result.reason, 'ROUTE_CLEAR');

  assert.strictEqual(result.pathVariant, 'direct_redeem');
  assert.strictEqual(result.variantPriority, 1);

  assert.ok(Array.isArray(result.availableVariants), 'availableVariants deve existir');
  assert.strictEqual(result.availableVariants.length, 3, 'availableVariants deve conter 3 variantes');

  assert.strictEqual(result.availableVariants[0].pathVariant, 'direct_redeem');
  assert.strictEqual(result.availableVariants[1].pathVariant, 'bridge_recovery');
  assert.strictEqual(result.availableVariants[2].pathVariant, 'manual_bridge_fallback');

  assert.ok(result.statePatch, 'statePatch deve existir');
  assert.ok(result.statePatch.routeOperatorByRoute, 'statePatch.routeOperatorByRoute deve existir');
  assert.ok(result.statePatch.lastRouteOperation, 'statePatch.lastRouteOperation deve existir');
  assert.ok(Array.isArray(result.statePatch.routeOperationHistory), 'routeOperationHistory deve ser array');

  assert.ok(
    Array.isArray(result.statePatch.routeOperatorByRoute.hbtc_to_btc_l1.availableVariants),
    'routeOperatorByRoute deve persistir availableVariants'
  );

  assert.strictEqual(
    result.statePatch.routeOperatorByRoute.hbtc_to_btc_l1.availableVariants.length,
    3,
    'routeOperatorByRoute deve persistir 3 variantes'
  );

  return result;
}

function testEvaluateRouteHealthBlocked() {
  const result = skill.evaluate({
    route: 'hbtc_to_btc_l1',
    state: {
      routeHealthByRoute: {
        hbtc_to_btc_l1: {
          status: 'blocked',
          reason: 'PROTOCOL_REDEEM_BLOCKED',
          updatedAt: '2026-03-25T19:00:00.000Z',
          incidentType: 'PROTOCOL_REDEEM_BLOCKED'
        }
      }
    }
  });

  assert.ok(result, 'evaluate deve retornar resultado');
  assert.strictEqual(result.decision, 'BLOCK');
  assert.strictEqual(result.reason, 'ROUTE_HEALTH_BLOCKED');
  assert.strictEqual(result.pathVariant, 'direct_redeem');
  assert.strictEqual(result.variantPriority, 1);
  assert.ok(Array.isArray(result.availableVariants), 'availableVariants deve existir mesmo em BLOCK');
  assert.strictEqual(result.availableVariants.length, 3);

  return result;
}

function testEvaluateProtocolHealthBlocked() {
  const result = skill.evaluate({
    route: 'hbtc_to_btc_l1',
    state: {
      protocolHealthByProtocol: {
        hermetica: {
          status: 'blocked',
          reason: 'missing_protocol_role',
          updatedAt: '2026-03-25T19:00:00.000Z',
          incidentType: 'PROTOCOL_REDEEM_BLOCKED'
        }
      }
    }
  });

  assert.ok(result, 'evaluate deve retornar resultado');
  assert.strictEqual(result.decision, 'BLOCK');
  assert.strictEqual(result.reason, 'PROTOCOL_HEALTH_BLOCKED');
  assert.strictEqual(result.pathVariant, 'direct_redeem');
  assert.strictEqual(result.variantPriority, 1);
  assert.ok(Array.isArray(result.availableVariants), 'availableVariants deve existir mesmo em BLOCK');
  assert.strictEqual(result.availableVariants.length, 3);

  return result;
}

function main() {
  const variants = testResolveAvailableVariants();
  const healthy = testEvaluateHealthyRoute();
  const routeBlocked = testEvaluateRouteHealthBlocked();
  const protocolBlocked = testEvaluateProtocolHealthBlocked();

  console.log('');
  console.log('OK: test-btc-l1-route-operator-v2 passou');

  printResult('resolveAvailableVariants(hbtc_to_btc_l1)', variants);
  printResult('evaluate() healthy route', healthy);
  printResult('evaluate() routeHealth blocked', routeBlocked);
  printResult('evaluate() protocolHealth blocked', protocolBlocked);
}

main();