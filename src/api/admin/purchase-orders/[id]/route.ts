import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { PURCHASE_ORDER_MODULE } from "../../../../modules/purchase-order"
import PurchaseOrderModuleService from "../../../../modules/purchase-order/service"
import { updatePurchaseOrderWorkflow } from "../../../../workflows/purchase-order/update-purchase-order"
import { UpdatePurchaseOrderBody } from "../../../validators"

// GET /admin/purchase-orders/:id
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const purchaseOrderService: PurchaseOrderModuleService = req.scope.resolve(
    PURCHASE_ORDER_MODULE
  )

  const purchaseOrder = await purchaseOrderService.retrievePurchaseOrder(
    req.params.id,
    { relations: ["items"] }
  )

  res.json({ purchase_order: purchaseOrder })
}

// POST /admin/purchase-orders/:id — draft only
export async function POST(
  req: MedusaRequest<UpdatePurchaseOrderBody>,
  res: MedusaResponse
) {
  const { result } = await updatePurchaseOrderWorkflow(req.scope).run({
    input: { id: req.params.id, ...req.validatedBody },
  })

  res.json({ purchase_order: result })
}
