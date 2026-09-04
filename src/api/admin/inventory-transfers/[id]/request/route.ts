import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { requestInventoryTransferWorkflow } from "../../../../../workflows/inventory-transfer/request-inventory-transfer"

// draft -> requested
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await requestInventoryTransferWorkflow(req.scope).run({
    input: { id: req.params.id },
  })

  res.json({ transfer: result })
}
