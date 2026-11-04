import type { SwaggerTransformObject } from '@fastify/swagger';
import { jsonSchemaTransformObject } from 'fastify-type-provider-zod';

type Document = ReturnType<SwaggerTransformObject>;

/**
 * Component schemas from the Zod registry, minus the ones no operation uses.
 *
 * fastify-type-provider-zod emits an input (`FooInput`) and an output (`Foo`)
 * variant of every registered schema; pruning keeps generated clients tidy.
 */
export const transformObject: SwaggerTransformObject = (input) => {
  const document = jsonSchemaTransformObject(input) as Document & {
    components?: { schemas?: Record<string, unknown> };
  };
  const schemas = document.components?.schemas;
  if (!schemas) return document;

  const used = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') {
        const name = value.replace('#/components/schemas/', '');
        if (!used.has(name)) {
          used.add(name);
          visit(schemas[name]);
        }
      } else {
        visit(value);
      }
    }
  };
  visit((document as { paths?: unknown }).paths);

  document.components!.schemas = Object.fromEntries(
    Object.entries(schemas).filter(([name]) => used.has(name)),
  );
  return document;
};
