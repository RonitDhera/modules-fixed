import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { shipInventoryTransferWorkflow } from "../../../../../workflows/inventory-transfer/ship-inventory-transfer"
import { ShipInventoryTransferBody } from "../../../../validators"

export async function POST(
  req: MedusaRequest<ShipInventoryTransferBody>,
  res: MedusaResponse
) {
  const { result } = await shipInventoryTransferWorkflow(req.scope).run({
    input: { id: req.params.id, lines: req.validatedBody.lines },
  })

  res.json({ transfer: result })
}
