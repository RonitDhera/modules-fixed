import { model } from "@medusajs/framework/utils"
import PurchaseOrder from "./purchase-order"

const PurchaseOrderLineItem = model.define("purchase_order_line_item", {
  id: model.id().primaryKey(),
  variant_id: model.text().nullable(),
  inventory_item_id: model.text().nullable(),
  title: model.text(),
  sku: model.text().nullable(),
  quantity_ordered: model.number(),
  quantity_received: model.number().default(0),
  unit_cost: model.bigNumber(),
  line_total: model.bigNumber(),
  purchase_order: model.belongsTo(() => PurchaseOrder, {
    mappedBy: "items",
  }),
})

export default PurchaseOrderLineItem