import { model } from "@medusajs/framework/utils"
import InventoryTransferLineItem from "./inventory-transfer-line-item"

const InventoryTransfer = model.define("inventory_transfer", {
  id: model.id().primaryKey(),
  transfer_number: model.text().unique(),
  from_location_id: model.text(),
  to_location_id: model.text(),
  status: model.enum([
    "draft",
    "requested",
    "in_transit",
    "received",
    "canceled",
  ]).default("draft"),
  notes: model.text().nullable(),
  shipped_at: model.dateTime().nullable(),
  received_at: model.dateTime().nullable(),
  items: model.hasMany(() => InventoryTransferLineItem, {
    mappedBy: "transfer",
  }),
})

export default InventoryTransfer