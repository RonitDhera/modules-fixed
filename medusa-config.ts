import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

export default defineConfig({
  modules: [
    { resolve: "./src/modules/purchase-order" },
    { resolve: "./src/modules/inventory-transfer" },
    { resolve: "./src/modules/analytics" },
  ],
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseOptions: process.env.DATABASE_SSL === "true"
      ? { ssl: { rejectUnauthorized: false } }
      : undefined,
    http: {
      storeCors: process.env.STORE_CORS || "http://localhost:8000",
      adminCors: process.env.ADMIN_CORS || "http://localhost:9000",
      authCors: process.env.AUTH_CORS || "http://localhost:9000",
      jwtSecret: process.env.JWT_SECRET || "fallback_jwt_secret",
      cookieSecret: process.env.COOKIE_SECRET || "fallback_cookie_secret",
    },
  } as any,
})