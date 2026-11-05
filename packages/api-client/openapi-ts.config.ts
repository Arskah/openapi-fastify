import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../../apps/server/openapi.json',
  output: {
    path: 'src/client',
    // Node runs this package's TypeScript directly, so imports need real extensions
    module: { extension: '.ts' },
  },
  plugins: ['@hey-api/client-fetch', '@hey-api/typescript', '@hey-api/sdk'],
});
