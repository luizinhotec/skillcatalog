'use strict';

const { run } = require('../skills/protocol-incident-guard/index.cjs');

const payload = {
  protocol: 'hermetica',
  functionName: 'request-redeem',
  contract: 'vault-hbtc-v1',
  txid: '7633da7e86df95bc16f49e5c3a66f33ed9ee08b0ac6810508aa7f9289a64389f',
  errorCode: 'u101008',
  errorName: 'ERR_NOT_PROTOCOL',
  context: {
    hqProtocolState: {
      'vault-hbtc-v1': false,
      'state-hbtc-v1': true,
      'protocol-enabled': true
    }
  }
};

const result = run(payload);

console.log(JSON.stringify(result, null, 2));
