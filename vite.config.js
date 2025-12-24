import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['croppie.ts'],
      rollupTypes: true
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'croppie.ts'),
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
