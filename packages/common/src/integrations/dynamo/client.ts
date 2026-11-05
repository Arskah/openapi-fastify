import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { CommonConfig } from '../../config.ts';
import type { Write } from './write.ts';

/** One client per process; shared by every repository through the container. */
export class DynamoClient {
  readonly #doc: DynamoDBDocumentClient;

  /** Sends a document-client command; repositories use this for reads. */
  readonly send: DynamoDBDocumentClient['send'];

  constructor(config: CommonConfig) {
    const client = new DynamoDBClient({
      region: config.aws.region,
      ...(config.aws.dynamoEndpoint && { endpoint: config.aws.dynamoEndpoint }),
    });
    this.#doc = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.send = this.#doc.send.bind(this.#doc);
  }

  /**
   * Writes atomically. A failed condition throws the error chosen by whoever
   * built that write. A single write skips the transaction (half the write cost).
   */
  async writeAtomically(writes: readonly Write[]): Promise<void> {
    const [only] = writes;
    if (writes.length === 1 && only) return this.#writeOne(only);

    try {
      await this.send(new TransactWriteCommand({ TransactItems: writes.map(({ op }) => op) }));
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

  destroy(): void {
    this.#doc.destroy();
  }

  async #writeOne({ op, onConditionFailed }: Write): Promise<void> {
    try {
      if (op.Put) await this.send(new PutCommand(op.Put));
      else if (op.Update) await this.send(new UpdateCommand(op.Update));
      else if (op.Delete) await this.send(new DeleteCommand(op.Delete));
      else await this.send(new TransactWriteCommand({ TransactItems: [op] }));
    } catch (error) {
      const mapped = error instanceof ConditionalCheckFailedException ? onConditionFailed?.() : undefined;
      throw mapped ?? error;
    }
  }
}
