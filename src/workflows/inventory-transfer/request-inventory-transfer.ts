import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"

import { INVENTORY_TRANSFER_MODULE } from "../../modules/inventory-transfer"
import InventoryTransferModuleService from "../../modules/inventory-transfer/service"
import {
  assertInventoryTransferTransition,
  InventoryTransferStatus,
} from "../../modules/inventory-transfer/statuses"
import { InventoryTransferDTO } from "../../modules/inventory-transfer/types"

export type RequestInventoryTransferInput = {
  id: string
}

/**
 * draft -> requested.
 *
 * The status flow in the brief has this step, and the enum always carried it,
 * but nothing ever set it — `requested` was an unreachable state.
 */
const requestInventoryTransferStep = createStep(
  "request-inventory-transfer-step",
  async (input: RequestInventoryTransferInput, { container }) => {
    const transferService: InventoryTransferModuleService = container.resolve(
      INVENTORY_TRANSFER_MODULE
    )

    const transfer = (await transferService.retrieveInventoryTransfer(input.id, {
      relations: ["items"],
    })) as unknown as InventoryTransferDTO

    assertInventoryTransferTransition(
      "request",
      transfer.status,
      transfer.transfer_number
    )

    if (!transfer.items.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Cannot submit transfer ${transfer.transfer_number} — it has no line items.`
      )
    }

    await transferService.updateInventoryTransfers({
      id: input.id,
      status: "requested",
    })

    const updated = (await transferService.retrieveInventoryTransfer(input.id, {
      relations: ["items"],
    })) as unknown as InventoryTransferDTO

    return new StepResponse(updated, {
      id: input.id,
      previousStatus: transfer.status,
    })
  },
  async (
    data: { id: string; previousStatus: InventoryTransferStatus } | undefined,
    { container }
  ) => {
    if (!data) {
      return
    }

    const transferService: InventoryTransferModuleService = container.resolve(
      INVENTORY_TRANSFER_MODULE
    )

    await transferService.updateInventoryTransfers({
      id: data.id,
      status: data.previousStatus,
    })
  }
)

export const requestInventoryTransferWorkflow = createWorkflow(
  "request-inventory-transfer",
  (input: RequestInventoryTransferInput) => {
    const transfer = requestInventoryTransferStep(input)

    return new WorkflowResponse(transfer)
  }
)
