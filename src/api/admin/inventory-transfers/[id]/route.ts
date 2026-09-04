import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { INVENTORY_TRANSFER_MODULE } from "../../../../modules/inventory-transfer"
import InventoryTransferModuleService from "../../../../modules/inventory-transfer/service"
import { updateInventoryTransferWorkflow } from "../../../../workflows/inventory-transfer/update-inventory-transfer"
import { UpdateInventoryTransferBody } from "../../../validators"

// GET /admin/inventory-transfers/:id
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const transferService: InventoryTransferModuleService = req.scope.resolve(
    INVENTORY_TRANSFER_MODULE
  )

  const transfer = await transferService.retrieveInventoryTransfer(
    req.params.id,
    { relations: ["items"] }
  )

  res.json({ transfer })
}

// POST /admin/inventory-transfers/:id — draft only
export async function POST(
  req: MedusaRequest<UpdateInventoryTransferBody>,
  res: MedusaResponse
) {
  const { result } = await updateInventoryTransferWorkflow(req.scope).run({
    input: { id: req.params.id, ...req.validatedBody },
  })

  res.json({ transfer: result })
}
