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
  process.once(signal, async () => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
  });
}

await app.listen({ host: config.server.host, port: config.server.port });
