#!/usr/bin/env bun

type RouteOperator = {
  decision?: string;
  reason?: string | null;
  protocol?: string | null;
};

type RouteHealth = {
  status?: string;
  reason?: string | null;
};

type ProtocolHealth = {
  status?: string;
  reason?: string | null;
};

type RouteScore = {
  status?: string;
  reason?: string | null;
  score?: number | null;
};

type State = {
  routeOperatorByRoute?: Record<string, RouteOperator>;
  routeHealthByRoute?: Record<string, RouteHealth>;
  protocolHealthByProtocol?: Record<string, ProtocolHealth>;
  routeScoreByRoute?: Record<string, RouteScore>;
};

type InputPayload = {
  route?: string;
  state?: State;
};

type Readiness = 'ready' | 'degraded' | 'blocked' | 'unknown';

type Decision = {
  readiness: Readiness;
  eligible: boolean;
  reason: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function buildUnknown(reason: string): Decision {
  return {
    readiness: 'unknown',
    eligible: false,
    reason
  };
}

function buildDecision(state: State, route: string): Decision {
  const routeOperator = state.routeOperatorByRoute?.[route] ?? null;
  const routeHealth = state.routeHealthByRoute?.[route] ?? null;
  const routeScore = state.routeScoreByRoute?.[route] ?? null;

  if (!routeOperator) {
    return buildUnknown('MISSING_ROUTE_OPERATOR');
  }

  if (!routeHealth) {
    return buildUnknown('MISSING_ROUTE_HEALTH');
  }

  if (!routeScore) {
    return buildUnknown('MISSING_ROUTE_SCORE');
  }

  const protocol = routeOperator.protocol ?? null;

  if (!protocol || !protocol.trim()) {
    return buildUnknown('MISSING_PROTOCOL_REFERENCE');
  }

  const protocolHealth = state.protocolHealthByProtocol?.[protocol] ?? null;

  if (!protocolHealth) {
    return buildUnknown('MISSING_PROTOCOL_HEALTH');
  }

  if (routeOperator.decision === 'BLOCK') {
    return {
      readiness: 'blocked',
      eligible: false,
      reason: routeOperator.reason || 'ROUTE_OPERATOR_BLOCKED'
    };
  }

  if (routeHealth.status === 'blocked') {
    return {
      readiness: 'blocked',
      eligible: false,
      reason: routeHealth.reason || 'ROUTE_HEALTH_BLOCKED'
    };
  }

  if (protocolHealth.status === 'blocked') {
    return {
      readiness: 'blocked',
      eligible: false,
      reason: protocolHealth.reason || 'PROTOCOL_BLOCKED'
    };
  }

  if (routeScore.status === 'degraded') {
    return {
      readiness: 'degraded',
      eligible: false,
      reason: routeScore.reason || 'ROUTE_SCORE_DEGRADED'
    };
  }

  return {
    readiness: 'ready',
    eligible: true,
    reason: 'EXECUTION_READY'
  };
}

function parseInput(raw: string): InputPayload {
  if (!raw || !raw.trim()) {
    throw new Error('EMPTY_INPUT');
  }

  const parsed: unknown = JSON.parse(raw);

  if (!isObject(parsed)) {
    throw new Error('INVALID_INPUT');
  }

  return parsed as InputPayload;
}

function buildResultOk(route: string, decision: Decision) {
  return {
    ok: true,
    skill: 'execution-readiness-guard',
    route,
    readiness: decision.readiness,
    eligible: decision.eligible,
    reason: decision.reason
  };
}

function buildResultError(error: string) {
  return {
    ok: false,
    skill: 'execution-readiness-guard',
    error
  };
}

async function main(): Promise<void> {
  try {
    const rawInput = await Bun.stdin.text();
    const input = parseInput(rawInput);

    if (!input.route || !input.route.trim()) {
      console.log(JSON.stringify(buildResultError('MISSING_ROUTE')));
      process.exit(1);
    }

    if (!input.state || !isObject(input.state)) {
      console.log(JSON.stringify(buildResultError('INVALID_STATE')));
      process.exit(1);
    }

    const decision = buildDecision(input.state, input.route);

    console.log(JSON.stringify(buildResultOk(input.route, decision)));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    console.log(JSON.stringify(buildResultError(message)));
    process.exit(1);
  }
}

main();