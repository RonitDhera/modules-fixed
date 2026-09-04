import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { submitPurchaseOrderWorkflow } from "../../../../../workflows/purchase-order/submit-purchase-order"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await submitPurchaseOrderWorkflow(req.scope).run({
    input: { id: req.params.id },
  })

  res.json({ purchase_order: result })
}
