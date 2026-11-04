import { z } from 'zod';

// Shared by todo.ts and project.ts, which reference each other's ids
export const TodoIdSchema = z.uuid().meta({ id: 'TodoId', description: 'Todo identifier' });
export const ProjectIdSchema = z.uuid().meta({ id: 'ProjectId', description: 'Project identifier' });
