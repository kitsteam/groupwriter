import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    mockReset: true,
    exclude: [...configDefaults.exclude, "**/dist/**"],
  },
});
