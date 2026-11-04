// Creates the DynamoDB tables used by common. Idempotent; intended for DynamoDB Local.
import { CreateTableCommand, DynamoDBClient, ResourceInUseException } from '@aws-sdk/client-dynamodb';
import { loadCommonConfig } from '../src/config.ts';

const config = loadCommonConfig();
const client = new DynamoDBClient({
  region: config.aws.region,
  ...(config.aws.dynamoEndpoint && { endpoint: config.aws.dynamoEndpoint }),
});

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
} catch (error) {
  if (!(error instanceof ResourceInUseException)) throw error;
  console.log(`Table '${config.tables.todos}' already exists`);
} finally {
  client.destroy();
}
