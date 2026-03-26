type RouteOperatorRecord = {
  decision?: string;
  protocol?: string;
} | null;

type HealthRecord = {
  status?: string;
  reason?: string;
} | null;

type ScoreRecord = {
  status?: string;
  reason?: string;
  score?: number;
} | null;

type State = {
  routeOperatorByRoute?: Record<string, RouteOperatorRecord>;
  routeHealthByRoute?: Record<string, HealthRecord>;
  protocolHealthByProtocol?: Record<string, HealthRecord>;
  routeScoreByRoute?: Record<string, ScoreRecord>;
};

type Input = {
  route: string;
  state: State;
};

type Readiness = 'healthy' | 'degraded' | 'blocked';

type SuccessOutput = {
  ok: true;
  route: string;
  readiness: Readiness;
  eligible: boolean;
  reason: string;
};

type ErrorOutput = {
  ok: false;
  error: 'INVALID_INPUT';
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function evaluateReadiness(input: Input): SuccessOutput {
  const route = input.route;
  const state = input.state ?? {};

  const routeOperator = state.routeOperatorByRoute?.[route];
  const protocol = routeOperator?.protocol;

  const routeHealth = state.routeHealthByRoute?.[route];
  const protocolHealth = protocol
    ? state.protocolHealthByProtocol?.[protocol]
    : undefined;
  const routeScore = state.routeScoreByRoute?.[route];

  if (!routeOperator || routeOperator.decision !== 'ALLOW') {
    return {
      ok: true,
      route,
      readiness: 'blocked',
      eligible: false,
      reason: 'ROUTE_NOT_ALLOWED'
    };
  }

  if (routeHealth?.status === 'blocked') {
    return {
      ok: true,
      route,
      readiness: 'blocked',
      eligible: false,
      reason: routeHealth.reason || 'ROUTE_BLOCKED'
    };
  }

  if (protocolHealth?.status === 'blocked') {
    return {
      ok: true,
      route,
      readiness: 'blocked',
      eligible: false,
      reason: protocolHealth.reason || 'PROTOCOL_BLOCKED'
    };
  }

  if (routeScore?.status === 'degraded') {
    return {
      ok: true,
      route,
      readiness: 'degraded',
      eligible: false,
      reason: routeScore.reason || 'ROUTE_UNDERPERFORMING'
    };
  }

  return {
    ok: true,
    route,
    readiness: 'healthy',
    eligible: true,
    reason: 'READY'
  };
}

function parseInput(raw: string): Input {
  const parsed = JSON.parse(raw) as Partial<Input>;

  if (
    !parsed ||
    !isNonEmptyString(parsed.route) ||
    typeof parsed.state !== 'object' ||
    parsed.state === null
  ) {
    throw new Error('INVALID_INPUT');
  }

  return {
    route: parsed.route,
    state: parsed.state as State
  };
}

function main(): void {
  let input = '';

  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (chunk: string) => {
    input += chunk;
  });

  process.stdin.on('end', () => {
    try {
      const parsed = parseInput(input);
      const result = evaluateReadiness(parsed);
      console.log(JSON.stringify(result));
    } catch {
      const errorResult: ErrorOutput = {
        ok: false,
        error: 'INVALID_INPUT'
      };
      console.error(JSON.stringify(errorResult));
      process.exitCode = 1;
    }
  });

  process.stdin.resume();
}

main();