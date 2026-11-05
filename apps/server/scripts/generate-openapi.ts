// Writes the OpenAPI document to apps/server/openapi.json without starting a listener.
import { writeFile } from 'node:fs/promises';
import { createContainer, staticFeatureFlags } from '@demo/common';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';

const config = loadConfig({ ...process.env, LOG_LEVEL: 'silent' });
const logger = createLogger(config);
const container = createContainer({ config, logger, featureFlags: staticFeatureFlags() });
const app = await buildApp({ logger, container });
await app.ready();

const outFile = new URL('../openapi.json', import.meta.url);
await writeFile(outFile, `${JSON.stringify(app.swagger(), null, 2)}\n`);
await app.close();
container.dispose();

console.log(`Wrote ${outFile.pathname}`);
