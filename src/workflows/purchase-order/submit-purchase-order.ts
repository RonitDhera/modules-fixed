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

export type SubmitPurchaseOrderInput = {
  id: string
}

const submitPurchaseOrderStep = createStep(
  "submit-purchase-order-step",
  async (input: SubmitPurchaseOrderInput, { container }) => {
    const purchaseOrderService: PurchaseOrderModuleService =
      container.resolve(PURCHASE_ORDER_MODULE)

    const purchaseOrder = (await purchaseOrderService.retrievePurchaseOrder(
      input.id,
      { relations: ["items"] }
    )) as unknown as PurchaseOrderDTO

    assertPurchaseOrderTransition(
      "submit",
      purchaseOrder.status,
      purchaseOrder.po_number
    )

    if (!purchaseOrder.items.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Cannot submit purchase order ${purchaseOrder.po_number} — it has no line items.`
      )
    }

    await purchaseOrderService.updatePurchaseOrders({
      id: input.id,
      status: "submitted",
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

export const submitPurchaseOrderWorkflow = createWorkflow(
  "submit-purchase-order",
  (input: SubmitPurchaseOrderInput) => {
    const purchaseOrder = submitPurchaseOrderStep(input)

    return new WorkflowResponse(purchaseOrder)
  }
)
