import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { INVENTORY_TRANSFER_MODULE } from "../../../modules/inventory-transfer"
import InventoryTransferModuleService from "../../../modules/inventory-transfer/service"
import { createInventoryTransferWorkflow } from "../../../workflows/inventory-transfer/create-inventory-transfer"
import {
  CreateInventoryTransferBody,
  ListInventoryTransfersQuerySchema,
} from "../../validators"

// GET /admin/inventory-transfers — paginated, filter by status and either location
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = ListInventoryTransfersQuerySchema.safeParse(req.query)

  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues.map((issue) => issue.message).join("; ")
    )
  }

  const { limit, offset, status, from_location_id, to_location_id, q } =
    parsed.data

  const transferService: InventoryTransferModuleService = req.scope.resolve(
    INVENTORY_TRANSFER_MODULE
  )

  const [transfers, count] =
    await transferService.listAndCountInventoryTransfers(
      {
        ...(status && { status }),
        ...(from_location_id && { from_location_id }),
        ...(to_location_id && { to_location_id }),
        ...(q && { transfer_number: { $ilike: `%${q}%` } }),
      },
      {
        skip: offset,
        take: limit,
        relations: ["items"],
        order: { created_at: "DESC" },
      }
    )

  res.json({ transfers, count, limit, offset })
}

// POST /admin/inventory-transfers
export async function POST(
  req: MedusaRequest<CreateInventoryTransferBody>,
  res: MedusaResponse
) {
  const { result } = await createInventoryTransferWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.status(201).json({ transfer: result })
}
