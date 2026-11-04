import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { CommonConfig } from '../../config.ts';
import type { DynamoClient } from '../../db/dynamo.ts';
import type { WriteOp } from '../../db/transaction.ts';
import type { Logger } from '../../logger.ts';
import type { Project } from './project.schema.ts';

export interface ProjectRepository {
  create(project: Project): Promise<void>;
  /** `consistent` reads see writes committed just before, e.g. by a transaction. */
  get(id: string, options?: { consistent?: boolean }): Promise<Project | undefined>;
  /** Op appending to `todoIds`; its condition fails if the project does not exist. */
  appendTodoOp(id: string, todoId: string, updatedAt: string): WriteOp;
}

export interface ProjectRepositoryDeps {
  config: CommonConfig;
  logger: Logger;
  dynamo: DynamoClient;
}

export function createProjectRepository({ config, logger, dynamo }: ProjectRepositoryDeps): ProjectRepository {
  const TableName = config.tables.projects;
  const log = logger.child({ component: 'ProjectRepository' });

  return {
    async create(project) {
      log.debug({ id: project.id }, 'put project');
      await dynamo.send(
        new PutCommand({
          TableName,
          Item: project,
          ConditionExpression: 'attribute_not_exists(id)',
        }),
      );
    },

    async get(id, { consistent = false } = {}) {
      log.debug({ id, consistent }, 'get project');
      const { Item } = await dynamo.send(new GetCommand({ TableName, Key: { id }, ConsistentRead: consistent }));
      return Item as Project | undefined;
    },

    appendTodoOp(id, todoId, updatedAt) {
      log.debug({ id, todoId }, 'queue append todo to project');
      return {
        Update: {
          TableName,
          Key: { id },
          ConditionExpression: 'attribute_exists(id)',
          UpdateExpression: 'SET todoIds = list_append(todoIds, :todoIds), updatedAt = :updatedAt',
          ExpressionAttributeValues: { ':todoIds': [todoId], ':updatedAt': updatedAt },
        },
      };
    },
  };
}
