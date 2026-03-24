'use strict';

const skill3 = require('../skills/execution-policy-guard/index.cjs');

const result = skill3.run({
  state: {
    routeOperatorByRoute: {},
    routeHealthByRoute: {
      hbtc_to_btc_l1: {
        status: 'blocked',
        reason: 'PROTOCOL_REDEEM_BLOCKED'
      }
    },
    protocolHealthByProtocol: {
      hermetica: {
        status: 'blocked',
        reason: 'missing_protocol_role'
      }
    },
    lastRouteOperation: {
      route: 'hbtc_to_btc_l1',
      decision: 'BLOCK',
      reason: 'ROUTE_HEALTH_BLOCKED'
    },
    executionPolicyByRoute: {},
    executionPolicyHistory: []
  },
  route: 'hbtc_to_btc_l1',
  protocol: 'hermetica'
});

console.log(JSON.stringify(result, null, 2));