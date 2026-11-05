import { createContainer, featureFlagsFromEnv, startFeatureFlags } from '@demo/common';
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createLogger } from './logger.ts';

const config = loadConfig();
const logger = createLogger(config);
// Async startup happens here, before wiring: once the provider resolves, flag checks are synchronous
const featureFlags = await startFeatureFlags({ ...featureFlagsFromEnv(process.env), logger });
const container = createContainer({ config, logger, featureFlags });
const app = await buildApp({ logger, container });

app.addHook('onClose', async () => {
  await featureFlags.shutdown();
  container.dispose();
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    app.close().catch((err: unknown) => {
      app.log.error({ err }, 'shutdown failed');
      process.exitCode = 1;
    });
  });
}

await app.listen({ host: config.server.host, port: config.server.port });
