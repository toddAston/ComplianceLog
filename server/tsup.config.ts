import { defineConfig } from "tsup";

// Bundles the server entrypoint to a single dist/server.js. esbuild inlines the
// client Zod schemas imported from ../src/domain so the "import, don't retype"
// rule (handoff constraint #7) holds without a monorepo workspace. Native /
// prebuilt deps stay external and are resolved from the shipped node_modules.
export default defineConfig({
  entry: { server: "src/server.ts" },
  format: ["esm"],
  target: "node22",
  platform: "node",
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["@node-rs/argon2", "postgres", "ioredis", "bullmq"],
});
