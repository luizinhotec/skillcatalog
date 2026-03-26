declare const process: {
  stdin: {
    setEncoding: (encoding: string) => void;
    on: {
      (event: 'data', listener: (chunk: unknown) => void): void;
      (event: 'end', listener: () => void): void;
      (event: 'error', listener: (error: unknown) => void): void;
    };
  };
  stdout: {
    write: (message: string) => void;
  };
  exitCode?: number;
};

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

type RouteHealthEntry = {
  status?: string;
  reason?: string;
};

type ProtocolHealthEntry = {
  status?: string;
  reason?: string;
};

type RouteScoreEntry = {
  status?: string;
  reason?: string;
  score?: number;
};

type ExecutionPolicyEntry = {
  decision?: string;
  reason?: string;
};

type RouteOperatorEntry = {
  protocol?: string;
};

type SkillState = {
  routeHealthByRoute?: Record<string, RouteHealthEntry | undefined>;
  protocolHealthByProtocol?: Record<string, ProtocolHealthEntry | undefined>;
  routeScoreByRoute?: Record<string, RouteScoreEntry | undefined>;
  executionPolicyByRoute?: Record<string, ExecutionPolicyEntry | undefined>;
  routeOperatorByRoute?: Record<string, RouteOperatorEntry | undefined>;
};

type SkillInput = {
  route?: string;
  state?: SkillState;
};

type SkillOutput = {
  ok: boolean;
  route?: string;
  riskLevel?: RiskLevel;
  riskScore?: number;
  reason?: string;
  error?: string;
};

function normalizeHealthStatus(value: string | undefined): HealthStatus | null {
  if (value === 'healthy' || value === 'degraded' || value === 'unhealthy') {
    return value;
  }

  return null;
}

function clampScore(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return value;
}

function resolveRiskLevel(score: number): RiskLevel {
  if (score <= 25) {
    return 'low';
  }

  if (score <= 50) {
    return 'medium';
  }

  if (score <= 75) {
    return 'high';
  }

  return 'critical';
}

function inferProtocolFromState(state: SkillState, route: string): string | null {
  const routeOperator = state.routeOperatorByRoute?.[route];

  if (routeOperator?.protocol && routeOperator.protocol.trim() !== '') {
    return routeOperator.protocol;
  }

  return null;
}

function buildRiskAssessment(input: SkillInput): SkillOutput {
  const route = input.route;

  if (!route || route.trim() === '') {
    return {
      ok: false,
      error: 'INVALID_ROUTE'
    };
  }

  const state = input.state;

  if (!state) {
    return {
      ok: false,
      route,
      error: 'MISSING_STATE'
    };
  }

  let riskScore = 0;
  const reasons: string[] = [];

  const routeHealth = state.routeHealthByRoute?.[route];
  const normalizedRouteHealth = normalizeHealthStatus(routeHealth?.status);

  if (normalizedRouteHealth === 'degraded') {
    riskScore += 25;
    reasons.push(routeHealth?.reason || 'ROUTE_DEGRADED');
  } else if (normalizedRouteHealth === 'unhealthy') {
    riskScore += 45;
    reasons.push(routeHealth?.reason || 'ROUTE_UNHEALTHY');
  }

  const protocol = inferProtocolFromState(state, route);

  if (protocol) {
    const protocolHealth = state.protocolHealthByProtocol?.[protocol];
    const normalizedProtocolHealth = normalizeHealthStatus(protocolHealth?.status);

    if (normalizedProtocolHealth === 'degraded') {
      riskScore += 20;
      reasons.push(protocolHealth?.reason || 'PROTOCOL_DEGRADED');
    } else if (normalizedProtocolHealth === 'unhealthy') {
      riskScore += 40;
      reasons.push(protocolHealth?.reason || 'PROTOCOL_UNHEALTHY');
    }
  }

  const routeScore = state.routeScoreByRoute?.[route];

  if (typeof routeScore?.score === 'number') {
    if (routeScore.score < 20) {
      riskScore += 35;
      reasons.push(routeScore.reason || 'ROUTE_SCORE_VERY_LOW');
    } else if (routeScore.score < 40) {
      riskScore += 20;
      reasons.push(routeScore.reason || 'ROUTE_SCORE_LOW');
    } else if (routeScore.score < 60) {
      riskScore += 10;
      reasons.push(routeScore.reason || 'ROUTE_SCORE_MID');
    } else if (routeScore.score >= 80) {
      riskScore -= 10;
    }
  }

  const executionPolicy = state.executionPolicyByRoute?.[route];

  if (executionPolicy?.decision === 'BLOCK') {
    riskScore += 20;
    reasons.push(executionPolicy.reason || 'EXECUTION_POLICY_BLOCKED');
  }

  const finalRiskScore = clampScore(riskScore);
  const riskLevel = resolveRiskLevel(finalRiskScore);
  const reason = reasons.length > 0 ? reasons.join(' | ') : 'RISK_CLEAR';

  return {
    ok: true,
    route,
    riskLevel,
    riskScore: finalRiskScore,
    reason
  };
}

function parseStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk: unknown) => {
      if (typeof chunk === 'string') {
        data += chunk;
      }
    });

    process.stdin.on('end', () => {
      resolve(data);
    });

    process.stdin.on('error', (error: unknown) => {
      if (error instanceof Error) {
        reject(error);
        return;
      }

      reject(new Error('STDIN_READ_ERROR'));
    });
  });
}

async function main(): Promise<void> {
  try {
    const rawInput = await parseStdin();
    const parsedInput = JSON.parse(rawInput) as SkillInput;
    const result = buildRiskAssessment(parsedInput);

    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';

    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        error: 'INVALID_INPUT',
        reason: message
      })}\n`
    );
    process.exitCode = 1;
  }
}

void main();

export {
  buildRiskAssessment,
  clampScore,
  inferProtocolFromState,
  normalizeHealthStatus,
  resolveRiskLevel
};

export type {
  ExecutionPolicyEntry,
  HealthStatus,
  ProtocolHealthEntry,
  RiskLevel,
  RouteHealthEntry,
  RouteOperatorEntry,
  RouteScoreEntry,
  SkillInput,
  SkillOutput,
  SkillState
};