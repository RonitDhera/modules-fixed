import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { INVENTORY_TRANSFER_MODULE } from "../../modules/inventory-transfer"
import InventoryTransferModuleService from "../../modules/inventory-transfer/service"
import {
  assertInventoryTransferTransition,
  InventoryTransferStatus,
} from "../../modules/inventory-transfer/statuses"
import { InventoryTransferDTO } from "../../modules/inventory-transfer/types"
import {
  adjustInventoryStep,
  ensureInventoryLevelsStep,
  InventoryAdjustment,
} from "../common/inventory-steps"

export type CancelInventoryTransferInput = {
  id: string
}

type CancellationPlan = {
  transfer_id: string
  previousStatus: InventoryTransferStatus
  /** Stock shipped but never received, to be put back at the source. */
  adjustments: InventoryAdjustment[]
}

const planCancellationStep = createStep(
  "plan-inventory-transfer-cancellation",
  async (input: CancelInventoryTransferInput, { container }) => {
    const transferService: InventoryTransferModuleService = container.resolve(
      INVENTORY_TRANSFER_MODULE
    )

    const transfer = (await transferService.retrieveInventoryTransfer(input.id, {
      relations: ["items"],
    })) as unknown as InventoryTransferDTO

    assertInventoryTransferTransition(
      "cancel",
      transfer.status,
      transfer.transfer_number
    )

    const adjustments: InventoryAdjustment[] = []

    // Anything in transit goes back to where it came from.
    if (transfer.status === "in_transit") {
      for (const item of transfer.items) {
        const inTransit = item.quantity_shipped - item.quantity_received

        if (inTransit > 0 && item.inventory_item_id) {
          adjustments.push({
            inventory_item_id: item.inventory_item_id,
            location_id: transfer.from_location_id,
            adjustment: inTransit,
          })
        }
      }
    }

    const plan: CancellationPlan = {
      transfer_id: input.id,
      previousStatus: transfer.status,
      adjustments,
    }

    return new StepResponse(plan)
  }
)

const persistCancellationStep = createStep(
  "persist-inventory-transfer-cancellation",
  async (plan: CancellationPlan, { container }) => {
    const transferService: InventoryTransferModuleService = container.resolve(
      INVENTORY_TRANSFER_MODULE
    )

    await transferService.updateInventoryTransfers({
      id: plan.transfer_id,
      status: "canceled",
    })

    const updated = (await transferService.retrieveInventoryTransfer(
      plan.transfer_id,
      { relations: ["items"] }
    )) as unknown as InventoryTransferDTO

    return new StepResponse(updated, plan)
  },
  async (plan: CancellationPlan | undefined, { container }) => {
    if (!plan) {
      return
    }

    const transferService: InventoryTransferModuleService = container.resolve(
      INVENTORY_TRANSFER_MODULE
    )

    await transferService.updateInventoryTransfers({
      id: plan.transfer_id,
      status: plan.previousStatus,
    })
  }
)

export const cancelInventoryTransferWorkflow = createWorkflow(
  "cancel-inventory-transfer",
  (input: CancelInventoryTransferInput) => {
    const plan = planCancellationStep(input)

    ensureInventoryLevelsStep(
      transform({ plan }, (data) => ({
        levels: data.plan.adjustments.map((adjustment) => ({
          inventory_item_id: adjustment.inventory_item_id,
          location_id: adjustment.location_id,
        })),
      }))
    )

    adjustInventoryStep(
      transform({ plan }, (data) => ({ adjustments: data.plan.adjustments }))
    )

    const transfer = persistCancellationStep(plan)

    return new WorkflowResponse(transfer)
  }
)
