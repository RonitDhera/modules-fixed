import { z } from "zod"

/**
 * Request schemas for every admin route in both modules.
 *
 * Line items require an `inventory_item_id`: both modules exist to move stock
 * through Medusa's Inventory module, and a line without one can never do that.
 */

const quantity = z.number().int().positive()
const money = z.number().nonnegative()

/* -------------------------------------------------------------- suppliers */

export const CreateSupplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required."),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  address: z.string().nullish(),
  currency_code: z.string().length(3).toLowerCase(),
  notes: z.string().nullish(),
})

export const UpdateSupplierSchema = CreateSupplierSchema.partial()

export type CreateSupplierBody = z.infer<typeof CreateSupplierSchema>
export type UpdateSupplierBody = z.infer<typeof UpdateSupplierSchema>

/* --------------------------------------------------------- purchase orders */

const PurchaseOrderLineSchema = z.object({
  inventory_item_id: z.string().min(1, "Each line needs an inventory item."),
  variant_id: z.string().nullish(),
  title: z.string().min(1),
  sku: z.string().nullish(),
  quantity_ordered: quantity,
  unit_cost: money,
})

export const CreatePurchaseOrderSchema = z.object({
  supplier_id: z.string().min(1, "A supplier is required."),
  stock_location_id: z.string().min(1, "A destination stock location is required."),
  currency_code: z.string().length(3).toLowerCase(),
  expected_delivery: z.string().datetime().nullish(),
  notes: z.string().nullish(),
  tax_total: money.optional(),
  shipping_total: money.optional(),
  items: z.array(PurchaseOrderLineSchema).min(1, "A PO needs at least one line."),
})

export const UpdatePurchaseOrderSchema = z.object({
  supplier_id: z.string().min(1).optional(),
  stock_location_id: z.string().min(1).optional(),
  currency_code: z.string().length(3).toLowerCase().optional(),
  expected_delivery: z.string().datetime().nullish(),
  notes: z.string().nullish(),
  tax_total: money.optional(),
  shipping_total: money.optional(),
  // Omit `items` entirely to leave the lines (and therefore the totals) alone.
  items: z.array(PurchaseOrderLineSchema).min(1).optional(),
})

export const ReceivePurchaseOrderSchema = z.object({
  lines: z
    .array(
      z.object({
        line_item_id: z.string().min(1),
        quantity_received: quantity,
      })
    )
    .min(1, "Enter a quantity for at least one line."),
})

export const ListPurchaseOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z
    .enum(["draft", "submitted", "partially_received", "received", "canceled"])
    .optional(),
  supplier_id: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
})

export type CreatePurchaseOrderBody = z.infer<typeof CreatePurchaseOrderSchema>
export type UpdatePurchaseOrderBody = z.infer<typeof UpdatePurchaseOrderSchema>
export type ReceivePurchaseOrderBody = z.infer<typeof ReceivePurchaseOrderSchema>

/* ------------------------------------------------------ inventory transfers */

const TransferLineSchema = z.object({
  inventory_item_id: z.string().min(1, "Each line needs an inventory item."),
  variant_id: z.string().nullish(),
  title: z.string().min(1),
  sku: z.string().nullish(),
  quantity_requested: quantity,
})

export const CreateInventoryTransferSchema = z
  .object({
    from_location_id: z.string().min(1, "A source location is required."),
    to_location_id: z.string().min(1, "A destination location is required."),
    notes: z.string().nullish(),
    items: z
      .array(TransferLineSchema)
      .min(1, "A transfer needs at least one line."),
  })
  .refine((data) => data.from_location_id !== data.to_location_id, {
    message: "Source and destination locations must be different.",
    path: ["to_location_id"],
  })

export const UpdateInventoryTransferSchema = z.object({
  from_location_id: z.string().min(1).optional(),
  to_location_id: z.string().min(1).optional(),
  notes: z.string().nullish(),
  items: z.array(TransferLineSchema).min(1).optional(),
})

export const ShipInventoryTransferSchema = z.object({
  lines: z
    .array(
      z.object({
        line_item_id: z.string().min(1),
        quantity_shipped: quantity,
      })
    )
    .min(1, "Enter a quantity for at least one line."),
})

export const ReceiveInventoryTransferSchema = z.object({
  lines: z
    .array(
      z.object({
        line_item_id: z.string().min(1),
        quantity_received: quantity,
      })
    )
    .min(1, "Enter a quantity for at least one line."),
  discrepancy_notes: z.string().nullish(),
  // Close the transfer even though less was shipped than requested.
  close_short: z.boolean().optional(),
})

export const ListInventoryTransfersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z
    .enum(["draft", "requested", "in_transit", "received", "canceled"])
    .optional(),
  from_location_id: z.string().min(1).optional(),
  to_location_id: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
})

export const ListSuppliersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().min(1).optional(),
})

export type CreateInventoryTransferBody = z.infer<
  typeof CreateInventoryTransferSchema
>
export type UpdateInventoryTransferBody = z.infer<
  typeof UpdateInventoryTransferSchema
>
export type ShipInventoryTransferBody = z.infer<
  typeof ShipInventoryTransferSchema
>
export type ReceiveInventoryTransferBody = z.infer<
  typeof ReceiveInventoryTransferSchema
>
