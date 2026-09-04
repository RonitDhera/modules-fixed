import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { IInventoryService } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"

import { INVENTORY_TRANSFER_MODULE } from "../../modules/inventory-transfer"
import InventoryTransferModuleService from "../../modules/inventory-transfer/service"
import {
  assertInventoryTransferTransition,
  InventoryTransferStatus,
} from "../../modules/inventory-transfer/statuses"
import { InventoryTransferDTO } from "../../modules/inventory-transfer/types"
import {
  adjustInventoryStep,
  assertSufficientStock,
  InventoryAdjustment,
} from "../common/inventory-steps"

export type ShipInventoryTransferLineInput = {
  line_item_id: string
  quantity_shipped: number
}

export type ShipInventoryTransferInput = {
  id: string
  lines: ShipInventoryTransferLineInput[]
}

type ShipLineUpdate = {
  id: string
  quantity_shipped: number
  previous_quantity_shipped: number
}

type ShipmentPlan = {
  transfer_id: string
  previousStatus: InventoryTransferStatus
  previousShippedAt: Date | null
  adjustments: InventoryAdjustment[]
  lineUpdates: ShipLineUpdate[]
}

const planShipmentStep = createStep(
  "plan-inventory-transfer-shipment",
  async (input: ShipInventoryTransferInput, { container }) => {
    const transferService: InventoryTransferModuleService = container.resolve(
      INVENTORY_TRANSFER_MODULE
    )
    const inventoryService: IInventoryService = container.resolve(
      Modules.INVENTORY
    )

    const transfer = (await transferService.retrieveInventoryTransfer(input.id, {
      relations: ["items"],
    })) as unknown as InventoryTransferDTO

    assertInventoryTransferTransition(
      "ship",
      transfer.status,
      transfer.transfer_number
    )

    const adjustments: InventoryAdjustment[] = []
    const lineUpdates: ShipLineUpdate[] = []

    for (const shipLine of input.lines) {
      const lineItem = transfer.items.find(
        (item) => item.id === shipLine.line_item_id
      )

      if (!lineItem) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Line item ${shipLine.line_item_id} is not on transfer ${transfer.transfer_number}.`
        )
      }

      const outstanding = lineItem.quantity_requested - lineItem.quantity_shipped

      if (shipLine.quantity_shipped > outstanding) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Cannot ship ${shipLine.quantity_shipped} of "${lineItem.title}" — only ${outstanding} left to ship.`
        )
      }

      if (!lineItem.inventory_item_id) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Line "${lineItem.title}" has no inventory item, so stock cannot be shipped against it.`
        )
      }

      // Never let a shipment drive the source location negative.
      await assertSufficientStock(
        inventoryService,
        lineItem.inventory_item_id,
        transfer.from_location_id,
        shipLine.quantity_shipped,
        lineItem.title
      )

      lineUpdates.push({
        id: lineItem.id,
        quantity_shipped: lineItem.quantity_shipped + shipLine.quantity_shipped,
        previous_quantity_shipped: lineItem.quantity_shipped,
      })

      adjustments.push({
        inventory_item_id: lineItem.inventory_item_id,
        location_id: transfer.from_location_id,
        adjustment: -shipLine.quantity_shipped,
      })
    }

    const plan: ShipmentPlan = {
      transfer_id: input.id,
      previousStatus: transfer.status,
      previousShippedAt: transfer.shipped_at,
      adjustments,
      lineUpdates,
    }

    return new StepResponse(plan)
  }
)

const persistShipmentStep = createStep(
  "persist-inventory-transfer-shipment",
  async (plan: ShipmentPlan, { container }) => {
    const transferService: InventoryTransferModuleService = container.resolve(
      INVENTORY_TRANSFER_MODULE
    )

    for (const update of plan.lineUpdates) {
      await transferService.updateInventoryTransferLineItems({
        id: update.id,
        quantity_shipped: update.quantity_shipped,
      })
    }

    await transferService.updateInventoryTransfers({
      id: plan.transfer_id,
      status: "in_transit",
      // Keep the original dispatch time across a second, partial shipment.
      shipped_at: plan.previousShippedAt ?? new Date(),
    })

    const updated = (await transferService.retrieveInventoryTransfer(
      plan.transfer_id,
      { relations: ["items"] }
    )) as unknown as InventoryTransferDTO

    return new StepResponse(updated, plan)
  },
  async (plan: ShipmentPlan | undefined, { container }) => {
    if (!plan) {
      return
    }

    const transferService: InventoryTransferModuleService = container.resolve(
      INVENTORY_TRANSFER_MODULE
    )

    for (const update of plan.lineUpdates) {
      await transferService.updateInventoryTransferLineItems({
        id: update.id,
        quantity_shipped: update.previous_quantity_shipped,
      })
    }

    await transferService.updateInventoryTransfers({
      id: plan.transfer_id,
      status: plan.previousStatus,
      shipped_at: plan.previousShippedAt,
    })
  }
)

export const shipInventoryTransferWorkflow = createWorkflow(
  "ship-inventory-transfer",
  (input: ShipInventoryTransferInput) => {
    const plan = planShipmentStep(input)

    adjustInventoryStep(
      transform({ plan }, (data) => ({ adjustments: data.plan.adjustments }))
    )

    const transfer = persistShipmentStep(plan)

    return new WorkflowResponse(transfer)
  }
)
