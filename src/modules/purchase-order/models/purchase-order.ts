import { model } from "@medusajs/framework/utils"
import PurchaseOrderLineItem from "./purchase-order-line-item"

const PurchaseOrder = model.define("purchase_order", {
  id: model.id().primaryKey(),
  po_number: model.text().unique(),
  supplier_id: model.text(),
  stock_location_id: model.text(),
  status: model.enum([
    "draft",
    "submitted",
    "partially_received",
    "received",
    "canceled",
  ]).default("draft"),
  currency_code: model.text(),
  expected_delivery: model.dateTime().nullable(),
  subtotal: model.bigNumber().default(0),
  tax_total: model.bigNumber().default(0),
  shipping_total: model.bigNumber().default(0),
  total: model.bigNumber().default(0),
  notes: model.text().nullable(),
  items: model.hasMany(() => PurchaseOrderLineItem, {
    mappedBy: "purchase_order",
  }),
})

export default PurchaseOrder