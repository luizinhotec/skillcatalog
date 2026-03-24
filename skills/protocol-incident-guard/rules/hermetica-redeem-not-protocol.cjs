'use strict';

function detect(payload) {
  const state = payload?.context?.hqProtocolState || {};

  const matches =
    payload?.protocol === 'hermetica' &&
    payload?.functionName === 'request-redeem' &&
    (payload?.errorCode === 'u101008' || payload?.errorName === 'ERR_NOT_PROTOCOL') &&
    state['vault-hbtc-v1'] === false &&
    state['state-hbtc-v1'] === true &&
    state['protocol-enabled'] === true;

  if (!matches) {
    return null;
  }

  const detectedAt = new Date().toISOString();

  return {
    type: 'PROTOCOL_REDEEM_BLOCKED',
    severity: 'critical',
    protocol: 'hermetica',
    routeHint: 'hbtc_to_btc_l1',
    contract: payload?.contract || 'vault-hbtc-v1',
    functionName: payload?.functionName || 'request-redeem',
    txid: payload?.txid || null,
    errorCode: payload?.errorCode || 'u101008',
    errorName: payload?.errorName || 'ERR_NOT_PROTOCOL',
    rootCause: 'missing_protocol_role',
    impact: 'global_redeem_block_likely',
    protocolHealth: 'blocked',
    incidentKey: 'hermetica:request-redeem:u101008:vault-not-protocol',
    detectedAt,
    summary: 'Hermetica redeem blocked because vault-hbtc-v1 is not PROTOCOL in hq-v1.',
    evidence: {
      hqProtocolState: state
    }
  };
}

module.exports = {
  detect
};
