import {
  defineMiddlewares,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ZodType } from "zod"

import {
  CreateInventoryTransferSchema,
  CreatePurchaseOrderSchema,
  CreateSupplierSchema,
  ReceiveInventoryTransferSchema,
  ReceivePurchaseOrderSchema,
  ShipInventoryTransferSchema,
  UpdateInventoryTransferSchema,
  UpdatePurchaseOrderSchema,
  UpdateSupplierSchema,
} from "./validators"

/**
 * Parses the request body with a zod schema and puts the result on
 * `req.validatedBody`.
 *
 * Written against this project's own zod rather than the framework's
 * `validateAndTransformBody` so the two copies of zod can't drift apart.
 * A failure raises MedusaError.INVALID_DATA, which Medusa's error handler
 * renders as a 400 — routes never see malformed input.
 */
export function validateBody(
  schema: ZodType
): (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => void {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {})

    if (!result.success) {
      const detail = result.error.issues
        .map((issue) => {
          const path = issue.path.join(".")
          return path ? `${path}: ${issue.message}` : issue.message
        })
        .join("; ")

      return next(
        new MedusaError(MedusaError.Types.INVALID_DATA, detail)
      )
    }

    req.validatedBody = result.data
    next()
  }
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/suppliers",
      method: "POST",
      middlewares: [validateBody(CreateSupplierSchema)],
    },
    {
      matcher: "/admin/suppliers/:id",
      method: "POST",
      middlewares: [validateBody(UpdateSupplierSchema)],
    },
    {
      matcher: "/admin/purchase-orders",
      method: "POST",
      middlewares: [validateBody(CreatePurchaseOrderSchema)],
    },
    {
      matcher: "/admin/purchase-orders/:id",
      method: "POST",
      middlewares: [validateBody(UpdatePurchaseOrderSchema)],
    },
    {
      matcher: "/admin/purchase-orders/:id/receive",
      method: "POST",
      middlewares: [validateBody(ReceivePurchaseOrderSchema)],
    },
    {
      matcher: "/admin/inventory-transfers",
      method: "POST",
      middlewares: [validateBody(CreateInventoryTransferSchema)],
    },
    {
      matcher: "/admin/inventory-transfers/:id",
      method: "POST",
      middlewares: [validateBody(UpdateInventoryTransferSchema)],
    },
    {
      matcher: "/admin/inventory-transfers/:id/ship",
      method: "POST",
      middlewares: [validateBody(ShipInventoryTransferSchema)],
    },
    {
      matcher: "/admin/inventory-transfers/:id/receive",
      method: "POST",
      middlewares: [validateBody(ReceiveInventoryTransferSchema)],
    },
  ],
})
