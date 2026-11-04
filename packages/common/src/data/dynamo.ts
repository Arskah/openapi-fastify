import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { CommonConfig } from '../config.ts';

export type DynamoClient = DynamoDBDocumentClient;

/** One client per process; shared by every repository through the container. */
export function createDynamoClient(config: CommonConfig): DynamoClient {
  const client = new DynamoDBClient({
    region: config.aws.region,
    ...(config.aws.dynamoEndpoint && { endpoint: config.aws.dynamoEndpoint }),
  });

  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}
