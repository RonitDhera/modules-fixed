import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

function required(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Copy .env.template to .env and fill it in.`
    )
  }

  return value
}

export default defineConfig({
  modules: [
    {
      resolve: "./src/modules/purchase-order",
    },
    {
      resolve: "./src/modules/inventory-transfer",
    },
  ],
  projectConfig: {
    databaseUrl: required("DATABASE_URL"),
    http: {
      storeCors: process.env.STORE_CORS || "http://localhost:8000",
      adminCors: process.env.ADMIN_CORS || "http://localhost:9000",
      authCors: process.env.AUTH_CORS || "http://localhost:9000",
      jwtSecret: required("JWT_SECRET"),
      cookieSecret: required("COOKIE_SECRET"),
    },
  },
})
