import type { CommonConfig } from '../config.ts';
import type { Logger } from '../logger.ts';
import type { DynamoClient } from './dynamo.ts';

export interface RepositoryDeps {
  config: CommonConfig;
  logger: Logger;
  dynamo: DynamoClient;
}
