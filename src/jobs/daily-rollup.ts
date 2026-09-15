import { MedusaContainer } from "@medusajs/framework/types"

export default async function dailyRollupJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[Analytics] Running nightly historical rollup job...")

  // Here we will add logic to query raw orders/products and save rolled-up metrics to analytics_snapshot
}

export const config = {
  name: "daily-analytics-rollup",
  schedule: "0 0 * * *", // Runs every night at midnight
}