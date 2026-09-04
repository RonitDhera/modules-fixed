import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { receiveInventoryTransferWorkflow } from "../../../../../workflows/inventory-transfer/receive-inventory-transfer"
import { ReceiveInventoryTransferBody } from "../../../../validators"

export async function POST(
  req: MedusaRequest<ReceiveInventoryTransferBody>,
  res: MedusaResponse
) {
  const { result } = await receiveInventoryTransferWorkflow(req.scope).run({
    input: {
      id: req.params.id,
      lines: req.validatedBody.lines,
      discrepancy_notes: req.validatedBody.discrepancy_notes,
      close_short: req.validatedBody.close_short,
    },
  })

  res.json({ transfer: result })
}
