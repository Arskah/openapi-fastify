import { applyTodoUpdate, type Todo, type UpdateTodoInput } from '../../domain/todo.ts';
import type { TodoRepository } from '../../ports/todo.repository.ts';
import { useTransaction, type Transactional, type TransactionDeps } from '../transaction.ts';
import { useCase, type UseCaseContext } from '../use-case.ts';
import { getTodo } from './getTodo.ts';

export type UpdateTodoDeps = UseCaseContext & TransactionDeps & { todoRepository: TodoRepository };

export const updateTodo = useCase(
  'updateTodo',
  useTransaction(async (ctx: Transactional<UpdateTodoDeps>, id: string, input: UpdateTodoInput): Promise<Todo> => {
    const current = await getTodo(ctx, id);
    const todo = applyTodoUpdate(current, input, new Date());
    // Conditional on `updatedAt`, so a concurrent update fails with ConflictError instead of being lost
    ctx.todoRepository.replace(ctx.tx, todo, current.updatedAt);
    ctx.tx.afterCommit(() => ctx.logger.info({ id, done: todo.done }, 'todo updated'));
    return todo;
  }),
);
