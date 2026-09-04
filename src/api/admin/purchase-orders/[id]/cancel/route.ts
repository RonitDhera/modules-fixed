import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { cancelPurchaseOrderWorkflow } from "../../../../../workflows/purchase-order/cancel-purchase-order"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await cancelPurchaseOrderWorkflow(req.scope).run({
    input: { id: req.params.id },
  })

  res.json({ purchase_order: result })
}
