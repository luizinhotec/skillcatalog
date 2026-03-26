'use strict';

const { spawnSync } = require('child_process');

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

const result = spawnSync(
  'bun',
  ['run', 'skills/execution-risk-scorer/execution-risk-scorer.ts'],
  {
    input: JSON.stringify(input),
    encoding: 'utf8'
  }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.stderr) {
  const stderr = result.stderr.trim();

  if (stderr) {
    console.error(stderr);
  }
}

if (result.stdout) {
  const stdout = result.stdout.trim();

  if (stdout) {
    console.log(stdout);
  }
}

if (typeof result.status === 'number') {
  process.exit(result.status);
}