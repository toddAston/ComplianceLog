import { defineConfig } from "drizzle-kit";

// drizzle-kit reads DATABASE_URL at generate/migrate time. The deploy pipeline
// runs `drizzle-kit migrate` in a one-shot container (see docker-compose `migrate`
// service) before the API starts — never from the API's own startup hook.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/fieldlog",
  },
  strict: true,
  verbose: true,
});
