import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { PURCHASE_ORDER_MODULE } from "../../../modules/purchase-order"
import PurchaseOrderModuleService from "../../../modules/purchase-order/service"
import { createPurchaseOrderWorkflow } from "../../../workflows/purchase-order/create-purchase-order"
import {
  CreatePurchaseOrderBody,
  ListPurchaseOrdersQuerySchema,
} from "../../validators"

// GET /admin/purchase-orders — paginated, filter by status/supplier, search PO number
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = ListPurchaseOrdersQuerySchema.safeParse(req.query)

  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues.map((issue) => issue.message).join("; ")
    )
  }

  const { limit, offset, status, supplier_id, q } = parsed.data

  const purchaseOrderService: PurchaseOrderModuleService = req.scope.resolve(
    PURCHASE_ORDER_MODULE
  )

  const [purchase_orders, count] =
    await purchaseOrderService.listAndCountPurchaseOrders(
      {
        ...(status && { status }),
        ...(supplier_id && { supplier_id }),
        ...(q && { po_number: { $ilike: `%${q}%` } }),
      },
      {
        skip: offset,
        take: limit,
        relations: ["items"],
        order: { created_at: "DESC" },
      }
    )

  res.json({ purchase_orders, count, limit, offset })
}

// POST /admin/purchase-orders
export async function POST(
  req: MedusaRequest<CreatePurchaseOrderBody>,
  res: MedusaResponse
) {
  const { result } = await createPurchaseOrderWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.status(201).json({ purchase_order: result })
}
