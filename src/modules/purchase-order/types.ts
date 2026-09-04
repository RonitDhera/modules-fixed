import { PurchaseOrderStatus } from "./statuses"

/**
 * Read shapes for the purchase-order module.
 *
 * `MedusaService` infers method signatures from the models, but it does not
 * narrow the result of a `retrieve*` call that passes `relations`. These DTOs
 * describe what the workflows actually read, so the rest of the module can be
 * typed instead of falling back to `any`.
 */

export type PurchaseOrderLineItemDTO = {
  id: string
  inventory_item_id: string | null
  variant_id: string | null
  title: string
  sku: string | null
  quantity_ordered: number
  quantity_received: number
  unit_cost: number
  line_total: number
}

export type PurchaseOrderDTO = {
  id: string
  po_number: string
  supplier_id: string
  stock_location_id: string
  status: PurchaseOrderStatus
  currency_code: string
  expected_delivery: Date | null
  subtotal: number
  tax_total: number
  shipping_total: number
  total: number
  notes: string | null
  created_at: Date
  updated_at: Date
  items: PurchaseOrderLineItemDTO[]
}

export type SupplierDTO = {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  currency_code: string
  notes: string | null
  created_at: Date
  updated_at: Date
}
