import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
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
import {
  adjustInventoryStep,
  ensureInventoryLevelsStep,
  InventoryAdjustment,
} from "../common/inventory-steps"

export type ReceiveInventoryTransferLineInput = {
  line_item_id: string
  quantity_received: number
}

export type ReceiveInventoryTransferInput = {
  id: string
  lines: ReceiveInventoryTransferLineInput[]
  discrepancy_notes?: string | null
  /**
   * Close the transfer even though less was shipped than requested — used when
   * the balance is never coming and the shortage should just be recorded.
   */
  close_short?: boolean
}

type ReceiveLineUpdate = {
  id: string
  quantity_received: number
  previous_quantity_received: number
}

type ReceiptPlan = {
  transfer_id: string
  previousStatus: InventoryTransferStatus
  previousNotes: string | null
  previousReceivedAt: Date | null
  nextStatus: InventoryTransferStatus
  nextNotes: string | null
  adjustments: InventoryAdjustment[]
  lineUpdates: ReceiveLineUpdate[]
}

const planReceiptStep = createStep(
  "plan-inventory-transfer-receipt",
  async (input: ReceiveInventoryTransferInput, { container }) => {
    const transferService: InventoryTransferModuleService = container.resolve(
      INVENTORY_TRANSFER_MODULE
    )

    const transfer = (await transferService.retrieveInventoryTransfer(input.id, {
      relations: ["items"],
    })) as unknown as InventoryTransferDTO

    assertInventoryTransferTransition(
      "receive",
      transfer.status,
      transfer.transfer_number
    )

    const adjustments: InventoryAdjustment[] = []
    const lineUpdates: ReceiveLineUpdate[] = []

    for (const receiveLine of input.lines) {
      const lineItem = transfer.items.find(
        (item) => item.id === receiveLine.line_item_id
      )

      if (!lineItem) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Line item ${receiveLine.line_item_id} is not on transfer ${transfer.transfer_number}.`
        )
      }

      /*
       * Outstanding is measured against what was SHIPPED, not what was
       * requested. That is what stops in-transit stock being counted twice.
       */
      const outstanding = lineItem.quantity_shipped - lineItem.quantity_received

      if (receiveLine.quantity_received > outstanding) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Cannot receive ${receiveLine.quantity_received} of "${lineItem.title}" — only ${outstanding} shipped but not yet received.`
        )
      }

      if (!lineItem.inventory_item_id) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Line "${lineItem.title}" has no inventory item, so stock cannot be received against it.`
        )
      }

      lineUpdates.push({
        id: lineItem.id,
        quantity_received:
          lineItem.quantity_received + receiveLine.quantity_received,
        previous_quantity_received: lineItem.quantity_received,
      })

      adjustments.push({
        inventory_item_id: lineItem.inventory_item_id,
        location_id: transfer.to_location_id,
        adjustment: receiveLine.quantity_received,
      })
    }

    const receivedById = new Map(
      lineUpdates.map((update) => [update.id, update.quantity_received])
    )

    const projected = transfer.items.map((item) => ({
      title: item.title,
      requested: item.quantity_requested,
      shipped: item.quantity_shipped,
      received: receivedById.get(item.id) ?? item.quantity_received,
    }))

    const allShippedReceived = projected.every(
      (line) => line.received >= line.shipped
    )
    const nothingLeftToShip = projected.every(
      (line) => line.shipped >= line.requested
    )
    const anyShipped = projected.some((line) => line.shipped > 0)

    /*
     * Completing needs all shipped stock received AND nothing left to ship —
     * otherwise the transfer stays in_transit so the balance can still be sent.
     * `close_short` is the explicit way out when the rest is never coming.
     */
    const isComplete =
      anyShipped &&
      allShippedReceived &&
      (nothingLeftToShip || input.close_short === true)

    const shortages = projected
      .filter((line) => line.received < line.requested)
      .map(
        (line) =>
          `${line.title}: requested ${line.requested}, shipped ${line.shipped}, received ${line.received}`
      )

    const noteParts = [transfer.notes, input.discrepancy_notes].filter(
      (part): part is string => Boolean(part)
    )

    if (isComplete && shortages.length) {
      noteParts.push(`Shortages on completion — ${shortages.join("; ")}.`)
    }

    const plan: ReceiptPlan = {
      transfer_id: input.id,
      previousStatus: transfer.status,
      previousNotes: transfer.notes,
      previousReceivedAt: transfer.received_at,
      nextStatus: isComplete ? "received" : transfer.status,
      nextNotes: noteParts.length ? noteParts.join("\n") : null,
      adjustments,
      lineUpdates,
    }

    return new StepResponse(plan)
  }
)

const persistReceiptStep = createStep(
  "persist-inventory-transfer-receipt",
  async (plan: ReceiptPlan, { container }) => {
    const transferService: InventoryTransferModuleService = container.resolve(
      INVENTORY_TRANSFER_MODULE
    )

    for (const update of plan.lineUpdates) {
      await transferService.updateInventoryTransferLineItems({
        id: update.id,
        quantity_received: update.quantity_received,
      })
    }

    await transferService.updateInventoryTransfers({
      id: plan.transfer_id,
      status: plan.nextStatus,
      notes: plan.nextNotes,
      ...(plan.nextStatus === "received" && { received_at: new Date() }),
    })

    const updated = (await transferService.retrieveInventoryTransfer(
      plan.transfer_id,
      { relations: ["items"] }
    )) as unknown as InventoryTransferDTO

    return new StepResponse(updated, plan)
  },
  async (plan: ReceiptPlan | undefined, { container }) => {
    if (!plan) {
      return
    }

    const transferService: InventoryTransferModuleService = container.resolve(
      INVENTORY_TRANSFER_MODULE
    )

    for (const update of plan.lineUpdates) {
      await transferService.updateInventoryTransferLineItems({
        id: update.id,
        quantity_received: update.previous_quantity_received,
      })
    }

    await transferService.updateInventoryTransfers({
      id: plan.transfer_id,
      status: plan.previousStatus,
      notes: plan.previousNotes,
      received_at: plan.previousReceivedAt,
    })
  }
)

export const receiveInventoryTransferWorkflow = createWorkflow(
  "receive-inventory-transfer",
  (input: ReceiveInventoryTransferInput) => {
    const plan = planReceiptStep(input)

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

    const transfer = persistReceiptStep(plan)

    return new WorkflowResponse(transfer)
  }
)
