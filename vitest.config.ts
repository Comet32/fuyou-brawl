import { defineConfig } from 'vitest/config';
import { listPublicImages } from './config/public-images.mjs';

export default defineConfig({
  define: { __PUBLIC_IMAGES__: JSON.stringify(listPublicImages()) },
  test: { include: ['tests/**/*.test.ts'] },
});
