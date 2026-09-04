import { model } from "@medusajs/framework/utils"
import InventoryTransfer from "./inventory-transfer"

const InventoryTransferLineItem = model.define("inventory_transfer_line_item", {
  id: model.id().primaryKey(),
  inventory_item_id: model.text().nullable(),
  variant_id: model.text().nullable(),
  title: model.text(),
  sku: model.text().nullable(),
  quantity_requested: model.number(),
  quantity_shipped: model.number().default(0),
  quantity_received: model.number().default(0),
  transfer: model.belongsTo(() => InventoryTransfer, {
    mappedBy: "items",
  }),
})

export default InventoryTransferLineItem