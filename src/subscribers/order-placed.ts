import { 
  SubscriberArgs, 
  type SubscriberConfig 
} from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ANALYTICS_MODULE } from "../modules/analytics"
import AnalyticsModuleService from "../modules/analytics/service"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const analyticsModuleService: AnalyticsModuleService = container.resolve(ANALYTICS_MODULE)


logger.info(`[Analytics] Order placed event received for order id: ${data.id}`)

  // Fetch order details (sales_channel_id, not store_id directly)
  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: data.id },
    fields: ["id", "total", "sales_channel_id", "created_at"],
  })

  const order = orders[0]
  if (!order) {
    logger.warn(`[Analytics] Order ${data.id} not found, skipping.`)
    return
  }

  // Resolve store_id by matching order's sales_channel_id to a store's default_sales_channel_id
  const { data: stores } = await query.graph({
    entity: "store",
    filters: { default_sales_channel_id: order.sales_channel_id },
    fields: ["id"],
  })

  const store_id = stores[0]?.id
  if (!store_id) {
    logger.warn(`[Analytics] Could not resolve store for order ${data.id} (sales_channel_id: ${order.sales_channel_id}), skipping.`)
    return
  }

  // Normalize today's date to midnight (so all orders on same day match same row)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existingSnapshots = await analyticsModuleService.listAnalyticsSnapshots({
    store_id,
    date: today,
  })

  if (existingSnapshots.length > 0) {
    const snapshot = existingSnapshots[0]
    await analyticsModuleService.updateAnalyticsSnapshots({
      id: snapshot.id,
      revenue: snapshot.revenue + (order.total || 0),
      orders_count: snapshot.orders_count + 1,
    })
    logger.info(`[Analytics] Updated snapshot for store ${store_id} on ${today.toDateString()}`)
  } else {
    await analyticsModuleService.createAnalyticsSnapshots({
      store_id,
      date: today,
      revenue: order.total || 0,
      orders_count: 1,
      top_products: null,
    })
    logger.info(`[Analytics] Created new snapshot for store ${store_id} on ${today.toDateString()}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}