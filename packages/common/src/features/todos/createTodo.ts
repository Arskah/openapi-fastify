import { newTodo, type CreateTodoInput, type Todo } from '../../domain/todo.ts';
import type { TodoRepository } from '../../ports/todo.repository.ts';
import { useTransaction, type Transactional, type TransactionDeps } from '../transaction.ts';
import { useCase, type UseCaseContext } from '../use-case.ts';

export type CreateTodoDeps = UseCaseContext & TransactionDeps & { todoRepository: TodoRepository };

/** With `projectId`, the caller is responsible for adding the todo to that project. */
export const createTodo = useCase(
  'createTodo',
  useTransaction(
    async (
      ctx: Transactional<CreateTodoDeps>,
      input: CreateTodoInput,
      options: { projectId?: string } = {},
    ): Promise<Todo> => {
      const todo = newTodo(input, new Date(), options);
      ctx.todoRepository.create(ctx.tx, todo);
      ctx.tx.afterCommit(() => ctx.logger.info({ id: todo.id }, 'todo created'));
      return todo;
    },
  ),
);
