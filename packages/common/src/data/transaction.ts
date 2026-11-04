import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { TransactWriteCommand, type TransactWriteItem } from '@aws-sdk/lib-dynamodb';
import type { DynamoClient } from './dynamo.ts';

/** One write in a DynamoDB transaction, built by a table module. */
export type WriteOp = TransactWriteItem;

export interface TransactionWrite {
  op: WriteOp;
  /** Error to throw when this op's condition check cancels the transaction. */
  onConditionFailed?: () => Error;
}

// DynamoDB limit per TransactWriteItems call
const MAX_WRITES = 100;

/** Commits all writes atomically; nothing is written if any condition fails. */
export async function transactWrite(dynamo: DynamoClient, writes: readonly TransactionWrite[]): Promise<void> {
  if (writes.length > MAX_WRITES) {
    throw new RangeError(`Transaction has ${writes.length} writes; DynamoDB allows at most ${MAX_WRITES}`);
  }
  try {
    await dynamo.send(new TransactWriteCommand({ TransactItems: writes.map(({ op }) => op) }));
  } catch (error) {
    // CancellationReasons line up with TransactItems, so map the failing op to its owner's error
    if (error instanceof TransactionCanceledException) {
      const index = error.CancellationReasons?.findIndex((reason) => reason.Code === 'ConditionalCheckFailed');
      const mapped = index === undefined ? undefined : writes[index]?.onConditionFailed?.();
      if (mapped) throw mapped;
    }
    throw error;
  }
}
