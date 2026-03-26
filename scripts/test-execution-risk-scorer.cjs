'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');

function runSkill(input) {
  const result = spawnSync(
    'bun',
    ['run', 'skills/execution-risk-scorer/execution-risk-scorer.ts'],
    {
      input: JSON.stringify(input),
      encoding: 'utf8'
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Skill exited with code ${result.status}`);
  }

  const stdout = (result.stdout || '').trim();

  if (!stdout) {
    throw new Error('Skill returned empty output');
  }

  return JSON.parse(stdout);
}

function testMediumRiskScenario() {
  const input = {
    route: 'hbtc_to_btc_l1',
    state: {
      routeOperatorByRoute: {
        hbtc_to_btc_l1: {
          protocol: 'hermetica'
        }
      },
      routeHealthByRoute: {
        hbtc_to_btc_l1: {
          status: 'degraded',
          reason: 'ROUTE_UNDERPERFORMING'
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
          status: 'degraded',
          reason: 'ROUTE_SCORE_LOW',
          score: 35
        }
      },
      executionPolicyByRoute: {
        hbtc_to_btc_l1: {
          decision: 'ALLOW',
          reason: 'EXECUTION_POLICY_CLEAR'
        }
      }
    }
  };

  const output = runSkill(input);

  assert.equal(output.ok, true);
  assert.equal(output.route, 'hbtc_to_btc_l1');
  assert.equal(output.riskLevel, 'medium');
  assert.equal(output.riskScore, 45);
  assert.equal(output.reason, 'ROUTE_UNDERPERFORMING | ROUTE_SCORE_LOW');
}

function testCriticalRiskScenario() {
  const input = {
    route: 'hbtc_to_btc_l1',
    state: {
      routeOperatorByRoute: {
        hbtc_to_btc_l1: {
          protocol: 'hermetica'
        }
      },
      routeHealthByRoute: {
        hbtc_to_btc_l1: {
          status: 'unhealthy',
          reason: 'ROUTE_UNHEALTHY'
        }
      },
      protocolHealthByProtocol: {
        hermetica: {
          status: 'unhealthy',
          reason: 'PROTOCOL_UNHEALTHY'
        }
      },
      routeScoreByRoute: {
        hbtc_to_btc_l1: {
          status: 'degraded',
          reason: 'ROUTE_SCORE_VERY_LOW',
          score: 10
        }
      },
      executionPolicyByRoute: {
        hbtc_to_btc_l1: {
          decision: 'BLOCK',
          reason: 'EXECUTION_POLICY_BLOCKED'
        }
      }
    }
  };

  const output = runSkill(input);

  assert.equal(output.ok, true);
  assert.equal(output.route, 'hbtc_to_btc_l1');
  assert.equal(output.riskLevel, 'critical');
  assert.equal(output.riskScore, 100);
  assert.equal(
    output.reason,
    'ROUTE_UNHEALTHY | PROTOCOL_UNHEALTHY | ROUTE_SCORE_VERY_LOW | EXECUTION_POLICY_BLOCKED'
  );
}

function testInvalidRouteScenario() {
  const input = {
    route: '',
    state: {}
  };

  const output = runSkill(input);

  assert.equal(output.ok, false);
  assert.equal(output.error, 'INVALID_ROUTE');
}

function main() {
  testMediumRiskScenario();
  testCriticalRiskScenario();
  testInvalidRouteScenario();

  console.log(
    JSON.stringify(
      {
        ok: true,
        skill: 'execution-risk-scorer',
        testsPassed: 3
      },
      null,
      2
    )
  );
}

main();