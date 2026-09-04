import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { PURCHASE_ORDER_MODULE } from "../../../modules/purchase-order"
import PurchaseOrderModuleService from "../../../modules/purchase-order/service"
import { createSupplierWorkflow } from "../../../workflows/purchase-order/supplier"
import { CreateSupplierBody, ListSuppliersQuerySchema } from "../../validators"

// GET /admin/suppliers — paginated, searchable by name
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = ListSuppliersQuerySchema.safeParse(req.query)

  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues.map((issue) => issue.message).join("; ")
    )
  }

  const { limit, offset, q } = parsed.data

  const purchaseOrderService: PurchaseOrderModuleService = req.scope.resolve(
    PURCHASE_ORDER_MODULE
  )

  const [suppliers, count] = await purchaseOrderService.listAndCountSuppliers(
    q ? { name: { $ilike: `%${q}%` } } : {},
    { skip: offset, take: limit, order: { name: "ASC" } }
  )

  res.json({ suppliers, count, limit, offset })
}

// POST /admin/suppliers
export async function POST(
  req: MedusaRequest<CreateSupplierBody>,
  res: MedusaResponse
) {
  const { result } = await createSupplierWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.status(201).json({ supplier: result })
}
