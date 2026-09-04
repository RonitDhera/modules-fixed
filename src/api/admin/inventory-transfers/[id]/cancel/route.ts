import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { cancelInventoryTransferWorkflow } from "../../../../../workflows/inventory-transfer/cancel-inventory-transfer"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await cancelInventoryTransferWorkflow(req.scope).run({
    input: { id: req.params.id },
  })

  res.json({ transfer: result })
}
