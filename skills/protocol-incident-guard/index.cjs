'use strict';

const hermeticaRule = require('./rules/hermetica-redeem-not-protocol.cjs');

const COOLDOWN_MS = 60 * 60 * 1000;
const INCIDENT_HISTORY_LIMIT = 20;

function ensureStateShape(state) {
  if (!state || typeof state !== 'object') state = {};

  if (!state.skillStatusById) state.skillStatusById = {};
  if (!state.protocolHealthByProtocol) state.protocolHealthByProtocol = {};
  if (!state.routeHealthByRoute) state.routeHealthByRoute = {};
  if (!Array.isArray(state.incidentHistory)) state.incidentHistory = [];
  if (!Array.isArray(state.routeHistory)) state.routeHistory = [];
  if (!state.alertCooldowns) state.alertCooldowns = {};

  return state;
}

function detectIncident(payload) {
  return hermeticaRule.detect(payload);
}

function buildCooldownPatch(state, incident) {
  const currentCooldowns = state.alertCooldowns || {};
  const entry = currentCooldowns[incident.incidentKey];
  const now = new Date(incident.detectedAt).getTime();

  let cooldownSuppressed = false;

  if (entry?.lastSentAt) {
    const delta = now - new Date(entry.lastSentAt).getTime();
    if (delta < COOLDOWN_MS) {
      cooldownSuppressed = true;
    }
  }

  const nextCooldownEntry = {
    lastSentAt: cooldownSuppressed ? entry?.lastSentAt || null : incident.detectedAt,
    hitCount: (entry?.hitCount || 0) + 1,
    suppressedCount: (entry?.suppressedCount || 0) + (cooldownSuppressed ? 1 : 0)
  };

  return {
    cooldownSuppressed,
    alertCooldowns: {
      ...currentCooldowns,
      [incident.incidentKey]: nextCooldownEntry
    }
  };
}

function buildIncidentPatch(state, incident, cooldownData) {
  const protocolHealthByProtocol = {
    ...(state.protocolHealthByProtocol || {}),
    [incident.protocol]: {
      status: incident.protocolHealth,
      updatedAt: incident.detectedAt,
      reason: incident.rootCause,
      incidentType: incident.type
    }
  };

  const routeHealthByRoute = {
    ...(state.routeHealthByRoute || {}),
    [incident.routeHint]: {
      status: 'blocked',
      updatedAt: incident.detectedAt,
      reason: incident.type
    }
  };

  const incidentHistory = [
    ...(state.incidentHistory || []),
    incident
  ].slice(-INCIDENT_HISTORY_LIMIT);

  const skillStatusById = {
    ...(state.skillStatusById || {}),
    'protocol-incident-guard': {
      status: 'active',
      updatedAt: incident.detectedAt
    }
  };

  return {
    skillStatusById,
    protocolHealthByProtocol,
    routeHealthByRoute,
    incidentHistory,
    lastProtocolIncident: incident,
    alertCooldowns: cooldownData.alertCooldowns
  };
}

function run(payload, options = {}) {
  const statusOnly = !!options.statusOnly;
  const baseState = ensureStateShape(payload?.state || {});

  if (statusOnly) {
    return {
      ok: true,
      statusOnly: true,
      protocolHealthByProtocol: baseState.protocolHealthByProtocol,
      lastProtocolIncident: baseState.lastProtocolIncident || null,
      alertCooldowns: baseState.alertCooldowns
    };
  }

  const incident = detectIncident(payload);

  if (!incident) {
    return {
      ok: true,
      incidentDetected: false,
      statePatch: {}
    };
  }

  const cooldownData = buildCooldownPatch(baseState, incident);
  const statePatch = buildIncidentPatch(baseState, incident, cooldownData);

  return {
    ok: true,
    skill: 'protocol-incident-guard',
    incidentDetected: true,
    incidentType: incident.type,
    severity: incident.severity,
    protocol: incident.protocol,
    protocolHealth: incident.protocolHealth,
    routeHint: incident.routeHint,
    cooldownSuppressed: cooldownData.cooldownSuppressed,
    notificationSent: false,
    incidentKey: incident.incidentKey,
    incident,
    statePatch
  };
}

module.exports = {
  run
};