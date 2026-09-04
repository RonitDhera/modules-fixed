import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"

import { PURCHASE_ORDER_MODULE } from "../../modules/purchase-order"
import PurchaseOrderModuleService from "../../modules/purchase-order/service"
import {
  assertPurchaseOrderTransition,
  PurchaseOrderStatus,
} from "../../modules/purchase-order/statuses"
import { PurchaseOrderDTO } from "../../modules/purchase-order/types"
import {
  adjustInventoryStep,
  ensureInventoryLevelsStep,
  InventoryAdjustment,
} from "../common/inventory-steps"

export type ReceivePurchaseOrderLineInput = {
  line_item_id: string
  quantity_received: number
}

export type ReceivePurchaseOrderInput = {
  id: string
  lines: ReceivePurchaseOrderLineInput[]
}

type LineUpdate = {
  id: string
  quantity_received: number
  previous_quantity_received: number
}

type ReceiptPlan = {
  purchase_order_id: string
  previousStatus: PurchaseOrderStatus
  nextStatus: PurchaseOrderStatus
  adjustments: InventoryAdjustment[]
  lineUpdates: LineUpdate[]
}

/**
 * Reads and validates only — no writes, so a rejected receipt changes nothing.
 * Everything the later steps need is worked out here.
 */
const planPurchaseOrderReceiptStep = createStep(
  "plan-purchase-order-receipt",
  async (input: ReceivePurchaseOrderInput, { container }) => {
    const purchaseOrderService: PurchaseOrderModuleService =
      container.resolve(PURCHASE_ORDER_MODULE)

    const purchaseOrder = (await purchaseOrderService.retrievePurchaseOrder(
      input.id,
      { relations: ["items"] }
    )) as unknown as PurchaseOrderDTO

    assertPurchaseOrderTransition(
      "receive",
      purchaseOrder.status,
      purchaseOrder.po_number
    )

    const adjustments: InventoryAdjustment[] = []
    const lineUpdates: LineUpdate[] = []

    for (const receiveLine of input.lines) {
      const lineItem = purchaseOrder.items.find(
        (item) => item.id === receiveLine.line_item_id
      )

      if (!lineItem) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Line item ${receiveLine.line_item_id} is not on purchase order ${purchaseOrder.po_number}.`
        )
      }

      const outstanding = lineItem.quantity_ordered - lineItem.quantity_received

      if (receiveLine.quantity_received > outstanding) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Cannot receive ${receiveLine.quantity_received} of "${lineItem.title}" — only ${outstanding} outstanding.`
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
        quantity_received: lineItem.quantity_received + receiveLine.quantity_received,
        previous_quantity_received: lineItem.quantity_received,
      })

      adjustments.push({
        inventory_item_id: lineItem.inventory_item_id,
        location_id: purchaseOrder.stock_location_id,
        adjustment: receiveLine.quantity_received,
      })
    }

    // Status is derived from what the PO will look like after these updates.
    const receivedById = new Map(
      lineUpdates.map((update) => [update.id, update.quantity_received])
    )

    const projected = purchaseOrder.items.map((item) => ({
      ordered: item.quantity_ordered,
      received: receivedById.get(item.id) ?? item.quantity_received,
    }))

    const allReceived = projected.every((line) => line.received >= line.ordered)
    const anyReceived = projected.some((line) => line.received > 0)

    const nextStatus: PurchaseOrderStatus = allReceived
      ? "received"
      : anyReceived
        ? "partially_received"
        : purchaseOrder.status

    const plan: ReceiptPlan = {
      purchase_order_id: input.id,
      previousStatus: purchaseOrder.status,
      nextStatus,
      adjustments,
      lineUpdates,
    }

    return new StepResponse(plan)
  }
)

/**
 * Writes the receipt to the PO. Runs after stock has moved, so if this fails
 * the inventory step's compensation puts the stock back.
 */
const persistPurchaseOrderReceiptStep = createStep(
  "persist-purchase-order-receipt",
  async (plan: ReceiptPlan, { container }) => {
    const purchaseOrderService: PurchaseOrderModuleService =
      container.resolve(PURCHASE_ORDER_MODULE)

    for (const update of plan.lineUpdates) {
      await purchaseOrderService.updatePurchaseOrderLineItems({
        id: update.id,
        quantity_received: update.quantity_received,
      })
    }

    await purchaseOrderService.updatePurchaseOrders({
      id: plan.purchase_order_id,
      status: plan.nextStatus,
    })

    const updated = (await purchaseOrderService.retrievePurchaseOrder(
      plan.purchase_order_id,
      { relations: ["items"] }
    )) as unknown as PurchaseOrderDTO

    return new StepResponse(updated, plan)
  },
  async (plan: ReceiptPlan | undefined, { container }) => {
    if (!plan) {
      return
    }

    const purchaseOrderService: PurchaseOrderModuleService =
      container.resolve(PURCHASE_ORDER_MODULE)

    for (const update of plan.lineUpdates) {
      await purchaseOrderService.updatePurchaseOrderLineItems({
        id: update.id,
        quantity_received: update.previous_quantity_received,
      })
    }

    await purchaseOrderService.updatePurchaseOrders({
      id: plan.purchase_order_id,
      status: plan.previousStatus,
    })
  }
)

export const receivePurchaseOrderWorkflow = createWorkflow(
  "receive-purchase-order",
  (input: ReceivePurchaseOrderInput) => {
    const plan = planPurchaseOrderReceiptStep(input)

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

    const purchaseOrder = persistPurchaseOrderReceiptStep(plan)

    return new WorkflowResponse(purchaseOrder)
  }
)
