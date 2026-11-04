// Creates the DynamoDB tables used by common. Idempotent; intended for DynamoDB Local.
import { setTimeout as sleep } from 'node:timers/promises';
import { CreateTableCommand, DynamoDBClient, ResourceInUseException } from '@aws-sdk/client-dynamodb';
import { loadCommonConfig } from '../src/config.ts';

const config = loadCommonConfig();
const client = new DynamoDBClient({
  region: config.aws.region,
  ...(config.aws.dynamoEndpoint && { endpoint: config.aws.dynamoEndpoint }),
});

// DynamoDB Local may still be starting (e.g. right after `docker compose up -d`)
const deadline = Date.now() + 30_000;

try {
  for (;;) {
    try {
      await client.send(
        new CreateTableCommand({
          TableName: config.tables.todos,
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
          KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        }),
      );
      console.log(`Created table '${config.tables.todos}'`);
      break;
    } catch (error) {
      if (error instanceof ResourceInUseException) {
        console.log(`Table '${config.tables.todos}' already exists`);
        break;
      }
      if (Date.now() > deadline) throw error;
      await sleep(500);
    }
  }
} finally {
  client.destroy();
}
