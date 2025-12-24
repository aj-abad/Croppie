import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'croppie.js'),
      name: 'Croppie',
      fileName: (format) => `croppie.${format === 'es' ? 'mjs' : format === 'cjs' ? 'cjs' : 'umd.js'}`,
      formats: ['es', 'cjs', 'umd']
    },
    rollupOptions: {
      output: {
        exports: 'default',
        globals: {}
      }
    },
    outDir: 'dist'
  }
});
