import {
  createStep,
  createWorkflow,
  StepResponse,
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

export type CancelPurchaseOrderInput = {
  id: string
}

const cancelPurchaseOrderStep = createStep(
  "cancel-purchase-order-step",
  async (input: CancelPurchaseOrderInput, { container }) => {
    const purchaseOrderService: PurchaseOrderModuleService =
      container.resolve(PURCHASE_ORDER_MODULE)

    const purchaseOrder = (await purchaseOrderService.retrievePurchaseOrder(
      input.id,
      { relations: ["items"] }
    )) as unknown as PurchaseOrderDTO

    assertPurchaseOrderTransition(
      "cancel",
      purchaseOrder.status,
      purchaseOrder.po_number
    )

    // Stock that is already on the shelf cannot be un-received by a cancel.
    const receivedLine = purchaseOrder.items.find(
      (item) => item.quantity_received > 0
    )

    if (receivedLine) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Cannot cancel purchase order ${purchaseOrder.po_number} — ${receivedLine.quantity_received} of "${receivedLine.title}" has already been received.`
      )
    }

    await purchaseOrderService.updatePurchaseOrders({
      id: input.id,
      status: "canceled",
    })

    const updated = (await purchaseOrderService.retrievePurchaseOrder(input.id, {
      relations: ["items"],
    })) as unknown as PurchaseOrderDTO

    return new StepResponse(updated, {
      id: input.id,
      previousStatus: purchaseOrder.status,
    })
  },
  async (
    data: { id: string; previousStatus: PurchaseOrderStatus } | undefined,
    { container }
  ) => {
    if (!data) {
      return
    }

    const purchaseOrderService: PurchaseOrderModuleService =
      container.resolve(PURCHASE_ORDER_MODULE)

    await purchaseOrderService.updatePurchaseOrders({
      id: data.id,
      status: data.previousStatus,
    })
  }
)

export const cancelPurchaseOrderWorkflow = createWorkflow(
  "cancel-purchase-order",
  (input: CancelPurchaseOrderInput) => {
    const purchaseOrder = cancelPurchaseOrderStep(input)

    return new WorkflowResponse(purchaseOrder)
  }
)
