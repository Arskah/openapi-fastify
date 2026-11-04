// Creates the DynamoDB tables used by common. Idempotent; intended for DynamoDB Local.
import { setTimeout as sleep } from 'node:timers/promises';
import { CreateTableCommand, DynamoDBClient, ResourceInUseException } from '@aws-sdk/client-dynamodb';
import { loadCommonConfig } from '../src/config.ts';
import { tables } from '../src/tables.ts';

const config = loadCommonConfig();
const client = new DynamoDBClient({
  region: config.aws.region,
  ...(config.aws.dynamoEndpoint && { endpoint: config.aws.dynamoEndpoint }),
});

// DynamoDB Local may still be starting (e.g. right after `docker compose up -d`)
const deadline = Date.now() + 30_000;

try {
  for (const definition of tables) {
    const input = definition(config);
    for (;;) {
      try {
        await client.send(new CreateTableCommand(input));
        console.log(`Created table '${input.TableName}'`);
        break;
      } catch (error) {
        if (error instanceof ResourceInUseException) {
          console.log(`Table '${input.TableName}' already exists`);
          break;
        }
        if (Date.now() > deadline) throw error;
        await sleep(500);
      }
    }
  }
} finally {
  client.destroy();
}
