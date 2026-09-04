import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { receivePurchaseOrderWorkflow } from "../../../../../workflows/purchase-order/receive-purchase-order"
import { ReceivePurchaseOrderBody } from "../../../../validators"

export async function POST(
  req: MedusaRequest<ReceivePurchaseOrderBody>,
  res: MedusaResponse
) {
  const { result } = await receivePurchaseOrderWorkflow(req.scope).run({
    input: { id: req.params.id, lines: req.validatedBody.lines },
  })

  res.json({ purchase_order: result })
}
