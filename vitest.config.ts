import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom", // localStorage 等を使う config テスト用
    include: ["src/**/*.test.ts"],
  },
});
