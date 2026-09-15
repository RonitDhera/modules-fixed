import { model } from "@medusajs/framework/utils"

export const AnalyticsSnapshot = model.define("analytics_snapshot", {
  id: model.id().primaryKey(),
  store_id: model.text(),
  date: model.dateTime(),
  revenue: model.float().default(0),
  orders_count: model.number().default(0),
  top_products: model.json().nullable(),
})