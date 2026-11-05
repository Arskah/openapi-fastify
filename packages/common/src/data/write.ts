import type { TransactWriteItem } from '@aws-sdk/lib-dynamodb';

/** One write, in TransactWriteItems shape. Table modules build these. */
export type WriteOp = TransactWriteItem;

export interface Write {
  op: WriteOp;
  /**
   * Identity of the written item, e.g. `todos#<id>`. DynamoDB rejects a
   * transaction that writes the same item twice, so the transaction checks it.
   */
  item: string;
  /** Error to throw when this write's condition check fails. */
  onConditionFailed?: () => Error;
}

// DynamoDB limit per TransactWriteItems call
export const MAX_WRITES = 100;
