import { createContainer, runWithContext, type Container } from '@demo/common';
import type { Context, Handler } from 'aws-lambda';
import type { Logger } from 'pino';
import { loadConfig, type LambdaConfig } from './config.ts';
import { createLogger } from './logger.ts';

export interface Invocation {
  container: Container<LambdaConfig>;
  /** Logger bound to this invocation (AWS account, function, request ID, ...). */
  logger: Logger;
  context: Context;
}

export type LambdaHandler<E, R> = (event: E, invocation: Invocation) => Promise<R>;

interface Runtime {
  container: Container<LambdaConfig>;
  logger: Logger;
}

// One per sandbox: built on the first invocation and reused while the sandbox stays warm
let runtime: Runtime | undefined;
let coldStart = true;

function getRuntime(): Runtime {
  if (!runtime) {
    const config = loadConfig();
    const logger = createLogger(config);
    runtime = { container: createContainer({ config, logger }), logger };
  }
  return runtime;
}

/** `arn:aws:lambda:<region>:<account>:function:<name>[:<alias>]` */
function parseFunctionArn(arn: string) {
  const [, , , region, accountId] = arn.split(':');
  return { region, accountId };
}

function invocationBindings(context: Context): Record<string, unknown> {
  const { region, accountId } = parseFunctionArn(context.invokedFunctionArn);
  return {
    requestId: context.awsRequestId,
    aws: {
      accountId,
      region,
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      traceId: process.env._X_AMZN_TRACE_ID,
    },
  };
}

/**
 * Scaffolding shared by every Lambda in this app.
 *
 * Builds config, root logger and container once per sandbox, then runs each
 * invocation inside `runWithContext` with a child logger bound to the
 * invocation. Common code logs through the container's context logger, so its
 * log lines carry the same AWS bindings without knowing it runs in Lambda.
 */
export function lambdaHandler<E, R>(handler: LambdaHandler<E, R>): Handler<E, R> {
  return async (event, context) => {
    const { container, logger: root } = getRuntime();
    const logger = root.child(invocationBindings(context));
    const isColdStart = coldStart;
    coldStart = false;

    return runWithContext({ logger }, async () => {
      const startedAt = performance.now();
      logger.info({ coldStart: isColdStart }, 'invocation started');
      try {
        return await handler(event, { container, logger, context });
      } catch (err) {
        logger.error({ err }, 'invocation failed');
        throw err;
      } finally {
        logger.info({ durationMs: Math.round(performance.now() - startedAt) }, 'invocation finished');
      }
    });
  };
}
