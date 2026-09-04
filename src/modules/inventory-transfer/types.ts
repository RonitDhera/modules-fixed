import { InventoryTransferStatus } from "./statuses"

/** Read shapes for the inventory-transfer module. See the PO module's types.ts. */

export type InventoryTransferLineItemDTO = {
  id: string
  inventory_item_id: string | null
  variant_id: string | null
  title: string
  sku: string | null
  quantity_requested: number
  quantity_shipped: number
  quantity_received: number
}

export type InventoryTransferDTO = {
  id: string
  transfer_number: string
  from_location_id: string
  to_location_id: string
  status: InventoryTransferStatus
  notes: string | null
  shipped_at: Date | null
  received_at: Date | null
  created_at: Date
  updated_at: Date
  items: InventoryTransferLineItemDTO[]
}
