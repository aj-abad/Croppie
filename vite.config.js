import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ["index.ts", "Croppie.vue", "component-types.ts", "croppie.ts"],
      insertTypesEntry: true,
      rollupTypes: false,
    }),
  ],
  build: {
    lib: {
      entry: {
        croppie: resolve(__dirname, "index.ts"),
        "croppie-core": resolve(__dirname, "croppie.ts"),
      },
      name: "Croppie",
      fileName: (format, entryName) =>
        `${entryName}.${format === "es" ? "mjs" : "cjs"}`,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["vue"],
      output: {
        exports: "named",
        globals: { vue: "Vue" },
      },
    },
    outDir: "dist",
  },
});
