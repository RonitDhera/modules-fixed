import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

function required(name: string): string {
  const value = process.env[name]

  if (!value) {
    if (process.env.NODE_ENV === "production" || process.env.CI) {
      return process.env[name] || "postgres://dummy:dummy@localhost:5432/dummy"
    }
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
    {
    resolve: "./src/modules/google-integration", // new
  },  
  ],
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL || required("DATABASE_URL"),
    http: {
      storeCors: process.env.STORE_CORS || "http://localhost:8000",
      adminCors: process.env.ADMIN_CORS || "http://localhost:9000",
      authCors: process.env.AUTH_CORS || "http://localhost:9000",
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  admin: {
    disable: true, 
  },
})
