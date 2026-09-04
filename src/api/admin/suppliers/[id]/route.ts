import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { PURCHASE_ORDER_MODULE } from "../../../../modules/purchase-order"
import PurchaseOrderModuleService from "../../../../modules/purchase-order/service"
import { updateSupplierWorkflow } from "../../../../workflows/purchase-order/supplier"
import { UpdateSupplierBody } from "../../../validators"

// GET /admin/suppliers/:id
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const purchaseOrderService: PurchaseOrderModuleService = req.scope.resolve(
    PURCHASE_ORDER_MODULE
  )

  const supplier = await purchaseOrderService.retrieveSupplier(req.params.id)

  res.json({ supplier })
}

// POST /admin/suppliers/:id
export async function POST(
  req: MedusaRequest<UpdateSupplierBody>,
  res: MedusaResponse
) {
  const { result } = await updateSupplierWorkflow(req.scope).run({
    input: { id: req.params.id, ...req.validatedBody },
  })

  res.json({ supplier: result })
}
