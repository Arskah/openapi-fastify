import { createContainer } from '@demo/common';
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createLogger } from './logger.ts';

const config = loadConfig();
const logger = createLogger(config);
const container = createContainer({ config, logger });
const app = await buildApp({ logger, container });

app.addHook('onClose', async () => container.dispose());

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
