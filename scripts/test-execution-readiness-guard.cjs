'use strict';

const assert = require('assert');
const { buildDecision, run } = require('../skills/execution-readiness-guard/index.cjs');

function buildHealthyState() {
  return {
    routeOperatorByRoute: {
      hbtc_to_btc_l1: {
        decision: 'ALLOW',
        protocol: 'hermetica'
      }
    },
    routeHealthByRoute: {
      hbtc_to_btc_l1: {
        status: 'healthy',
        reason: 'ROUTE_CLEAR'
      }
    },
    protocolHealthByProtocol: {
      hermetica: {
        status: 'healthy',
        reason: 'PROTOCOL_CLEAR'
      }
    },
    routeScoreByRoute: {
      hbtc_to_btc_l1: {
        status: 'healthy',
        reason: 'ROUTE_SCORE_OK',
        score: 90
      }
    }
  };
}

function testMissingRoute() {
  const result = run({
    state: buildHealthyState()
  });

  assert.deepEqual(result, {
    ok: false,
    skill: 'execution-readiness-guard',
    error: 'MISSING_ROUTE'
  });
}

function testMissingState() {
  const result = run({
    route: 'hbtc_to_btc_l1'
  });

  assert.deepEqual(result, {
    ok: false,
    skill: 'execution-readiness-guard',
    error: 'INVALID_STATE'
  });
}

function testRouteWithoutData() {
  const result = run({
    route: 'missing_route',
    state: buildHealthyState()
  });

  assert.deepEqual(result, {
    ok: true,
    skill: 'execution-readiness-guard',
    route: 'missing_route',
    readiness: 'unknown',
    eligible: false,
    reason: 'MISSING_ROUTE_OPERATOR'
  });
}

function testOperatorBlocked() {
  const state = buildHealthyState();
  state.routeOperatorByRoute.hbtc_to_btc_l1.decision = 'BLOCK';
  state.routeOperatorByRoute.hbtc_to_btc_l1.reason = 'ROUTE_OPERATOR_BLOCKED';

  const result = run({
    route: 'hbtc_to_btc_l1',
    state
  });

  assert.deepEqual(result, {
    ok: true,
    skill: 'execution-readiness-guard',
    route: 'hbtc_to_btc_l1',
    readiness: 'blocked',
    eligible: false,
    reason: 'ROUTE_OPERATOR_BLOCKED'
  });
}

function testRouteBlocked() {
  const state = buildHealthyState();
  state.routeHealthByRoute.hbtc_to_btc_l1.status = 'blocked';
  state.routeHealthByRoute.hbtc_to_btc_l1.reason = 'ROUTE_HEALTH_BLOCKED';

  const result = run({
    route: 'hbtc_to_btc_l1',
    state
  });

  assert.deepEqual(result, {
    ok: true,
    skill: 'execution-readiness-guard',
    route: 'hbtc_to_btc_l1',
    readiness: 'blocked',
    eligible: false,
    reason: 'ROUTE_HEALTH_BLOCKED'
  });
}

function testProtocolBlocked() {
  const state = buildHealthyState();
  state.protocolHealthByProtocol.hermetica.status = 'blocked';
  state.protocolHealthByProtocol.hermetica.reason = 'PROTOCOL_BLOCKED';

  const result = run({
    route: 'hbtc_to_btc_l1',
    state
  });

  assert.deepEqual(result, {
    ok: true,
    skill: 'execution-readiness-guard',
    route: 'hbtc_to_btc_l1',
    readiness: 'blocked',
    eligible: false,
    reason: 'PROTOCOL_BLOCKED'
  });
}

function testDegraded() {
  const state = buildHealthyState();
  state.routeScoreByRoute.hbtc_to_btc_l1.status = 'degraded';
  state.routeScoreByRoute.hbtc_to_btc_l1.reason = 'ROUTE_UNDERPERFORMING';

  const result = run({
    route: 'hbtc_to_btc_l1',
    state
  });

  assert.deepEqual(result, {
    ok: true,
    skill: 'execution-readiness-guard',
    route: 'hbtc_to_btc_l1',
    readiness: 'degraded',
    eligible: false,
    reason: 'ROUTE_UNDERPERFORMING'
  });
}

function testReady() {
  const state = buildHealthyState();

  const result = run({
    route: 'hbtc_to_btc_l1',
    state
  });

  assert.deepEqual(result, {
    ok: true,
    skill: 'execution-readiness-guard',
    route: 'hbtc_to_btc_l1',
    readiness: 'ready',
    eligible: true,
    reason: 'EXECUTION_READY'
  });
}

function testDeterministicOutput() {
  const input = {
    route: 'hbtc_to_btc_l1',
    state: buildHealthyState()
  };

  const first = run(input);
  const second = run(input);

  assert.deepEqual(first, second);
}

function testBuildDecisionMissingData() {
  const decision = buildDecision({}, 'hbtc_to_btc_l1');

  assert.deepEqual(decision, {
    readiness: 'unknown',
    eligible: false,
    reason: 'MISSING_ROUTE_OPERATOR'
  });
}

function main() {
  testMissingRoute();
  testMissingState();
  testRouteWithoutData();
  testOperatorBlocked();
  testRouteBlocked();
  testProtocolBlocked();
  testDegraded();
  testReady();
  testDeterministicOutput();
  testBuildDecisionMissingData();

  console.log(
    JSON.stringify(
      {
        ok: true,
        skill: 'execution-readiness-guard',
        testsPassed: 10
      },
      null,
      2
    )
  );
}

main();
