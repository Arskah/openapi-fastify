import { ConditionalCheckFailedException, TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  PutCommand,
  TransactWriteCommand,
  type TransactWriteItem,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { DynamoClient } from './dynamo.ts';

/** One write, in TransactWriteItems shape. Table modules build these. */
export type WriteOp = TransactWriteItem;

export interface Write {
  op: WriteOp;
  /**
   * Identity of the written item, e.g. `todos#<id>`. DynamoDB rejects a
   * transaction that writes the same item twice, so the unit of work checks it.
   */
  item: string;
  /** Error to throw when this write's condition check fails. */
  onConditionFailed?: () => Error;
}

// DynamoDB limit per TransactWriteItems call
export const MAX_WRITES = 100;

/** Commits writes atomically. A single write skips the transaction (half the write cost). */
export async function commitWrites(dynamo: DynamoClient, writes: readonly Write[]): Promise<void> {
  const [only] = writes;
  if (writes.length === 1 && only) return commitOne(dynamo, only);

  try {
    await dynamo.send(new TransactWriteCommand({ TransactItems: writes.map(({ op }) => op) }));
  } catch (error) {
    // CancellationReasons line up with TransactItems, so map the failing write to its owner's error
    if (error instanceof TransactionCanceledException) {
      const index = error.CancellationReasons?.findIndex((reason) => reason.Code === 'ConditionalCheckFailed');
      const mapped = index === undefined ? undefined : writes[index]?.onConditionFailed?.();
      if (mapped) throw mapped;
    }
    throw error;
  }
}

async function commitOne(dynamo: DynamoClient, { op, onConditionFailed }: Write): Promise<void> {
  try {
    if (op.Put) await dynamo.send(new PutCommand(op.Put));
    else if (op.Update) await dynamo.send(new UpdateCommand(op.Update));
    else if (op.Delete) await dynamo.send(new DeleteCommand(op.Delete));
    else await dynamo.send(new TransactWriteCommand({ TransactItems: [op] }));
  } catch (error) {
    const mapped = error instanceof ConditionalCheckFailedException ? onConditionFailed?.() : undefined;
    throw mapped ?? error;
  }
}
