import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ANALYTICS_MODULE } from "../modules/analytics"
import AnalyticsModuleService from "../modules/analytics/service"

export default async function dailyRollupJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const analyticsModuleService: AnalyticsModuleService = container.resolve(ANALYTICS_MODULE)

  logger.info("[Analytics] Running nightly historical rollup job...")

  // Calculate "yesterday" date range
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)

  const endOfYesterday = new Date(yesterday)
  endOfYesterday.setHours(23, 59, 59, 999)

  // Build a sales_channel_id -> store_id map (since Order has no direct store_id)
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "default_sales_channel_id"],
  })

  const salesChannelToStore: Record<string, string> = {}
  for (const store of stores as any[]) {
    if (store.default_sales_channel_id) {
      salesChannelToStore[store.default_sales_channel_id] = store.id
    }
  }

  // Fetch all orders placed yesterday
  const { data: ordersRaw } = await query.graph({
    entity: "order",
    filters: {
      created_at: { $gte: yesterday, $lte: endOfYesterday },
    },
    fields: ["id", "total", "sales_channel_id", "items.product_id", "items.quantity", "items.title"],
  })

  const orders = ordersRaw as any[]

  // Group orders by resolved store_id
  const storeMap: Record<string, { revenue: number; orders_count: number; productCounts: Record<string, { title: string; qty: number }> }> = {}

  for (const order of orders) {
    const store_id = salesChannelToStore[order.sales_channel_id]
    if (!store_id) {
      logger.warn(`[Analytics] Skipping order ${order.id} — no store found for sales_channel_id ${order.sales_channel_id}`)
      continue
    }

    if (!storeMap[store_id]) {
      storeMap[store_id] = { revenue: 0, orders_count: 0, productCounts: {} }
    }
    storeMap[store_id].revenue += order.total || 0
    storeMap[store_id].orders_count += 1

    for (const item of order.items || []) {
      const key = item.product_id
      if (!storeMap[store_id].productCounts[key]) {
        storeMap[store_id].productCounts[key] = { title: item.title, qty: 0 }
      }
      storeMap[store_id].productCounts[key].qty += item.quantity || 0
    }
  }

  // Save/update a snapshot row per store for yesterday's date
  for (const store_id of Object.keys(storeMap)) {
    const { revenue, orders_count, productCounts } = storeMap[store_id]

    const topProducts = Object.entries(productCounts)
      .map(([product_id, val]) => ({ product_id, title: val.title, qty: val.qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)

    const existing = await analyticsModuleService.listAnalyticsSnapshots({
      store_id,
      date: yesterday,
    })

    if (existing.length > 0) {
  await analyticsModuleService.updateAnalyticsSnapshots({
    id: existing[0].id,
    revenue,
    orders_count,
    top_products: topProducts as any,
  })
} else {
  await analyticsModuleService.createAnalyticsSnapshots({
    store_id,
    date: yesterday,
    revenue,
    orders_count,
    top_products: topProducts as any,
  })
}

    logger.info(`[Analytics] Rolled up ${store_id}: revenue=${revenue}, orders=${orders_count}`)
  }

  logger.info("[Analytics] Nightly rollup completed.")
}

export const config = {
  name: "daily-analytics-rollup",
  schedule: "0 0 * * *",
}