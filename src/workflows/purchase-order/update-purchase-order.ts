import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { PURCHASE_ORDER_MODULE } from "../../modules/purchase-order"
import PurchaseOrderModuleService from "../../modules/purchase-order/service"
import { assertPurchaseOrderTransition } from "../../modules/purchase-order/statuses"
import {
  PurchaseOrderDTO,
  PurchaseOrderLineItemDTO,
} from "../../modules/purchase-order/types"
import { calculateTotals, lineTotal } from "./steps/calculate-po-totals"

export type UpdatePurchaseOrderLineInput = {
  inventory_item_id: string
  variant_id?: string | null
  title: string
  sku?: string | null
  quantity_ordered: number
  unit_cost: number
}

export type UpdatePurchaseOrderInput = {
  id: string
  supplier_id?: string
  stock_location_id?: string
  currency_code?: string
  expected_delivery?: string | null
  notes?: string | null
  tax_total?: number
  shipping_total?: number
  /** Omit entirely to leave the existing lines — and totals — untouched. */
  items?: UpdatePurchaseOrderLineInput[]
}

type UpdateSnapshot = {
  id: string
  previous: {
    supplier_id: string
    stock_location_id: string
    currency_code: string
    expected_delivery: Date | null
    notes: string | null
    subtotal: number
    tax_total: number
    shipping_total: number
    total: number
  }
  previousItems: PurchaseOrderLineItemDTO[] | null
}

const updatePurchaseOrderStep = createStep(
  "update-purchase-order-step",
  async (input: UpdatePurchaseOrderInput, { container }) => {
    const purchaseOrderService: PurchaseOrderModuleService =
      container.resolve(PURCHASE_ORDER_MODULE)

    const existing = (await purchaseOrderService.retrievePurchaseOrder(
      input.id,
      { relations: ["items"] }
    )) as unknown as PurchaseOrderDTO

    assertPurchaseOrderTransition("update", existing.status, existing.po_number)

    const snapshot: UpdateSnapshot = {
      id: input.id,
      previous: {
        supplier_id: existing.supplier_id,
        stock_location_id: existing.stock_location_id,
        currency_code: existing.currency_code,
        expected_delivery: existing.expected_delivery,
        notes: existing.notes,
        subtotal: Number(existing.subtotal),
        tax_total: Number(existing.tax_total),
        shipping_total: Number(existing.shipping_total),
        total: Number(existing.total),
      },
      previousItems: input.items ? existing.items : null,
    }

    if (input.items) {
      if (existing.items.length) {
        await purchaseOrderService.deletePurchaseOrderLineItems(
          existing.items.map((item) => item.id)
        )
      }

      await purchaseOrderService.createPurchaseOrderLineItems(
        input.items.map((item) => ({
          purchase_order_id: input.id,
          inventory_item_id: item.inventory_item_id,
          variant_id: item.variant_id ?? null,
          title: item.title,
          sku: item.sku ?? null,
          quantity_ordered: item.quantity_ordered,
          quantity_received: 0,
          unit_cost: item.unit_cost,
          line_total: lineTotal(item.quantity_ordered, item.unit_cost),
        }))
      )
    }

    /*
     * Totals are only recomputed from the lines that are actually on the PO.
     * Previously this ran `items ?? []` through the totals step on every
     * update, so changing just the notes rewrote subtotal and total to 0.
     */
    const totalsSource = input.items
      ? input.items
      : existing.items.map((item) => ({
          quantity_ordered: item.quantity_ordered,
          unit_cost: Number(item.unit_cost),
        }))

    const totals = calculateTotals({
      items: totalsSource,
      tax_total: input.tax_total ?? Number(existing.tax_total),
      shipping_total: input.shipping_total ?? Number(existing.shipping_total),
    })

    await purchaseOrderService.updatePurchaseOrders({
      id: input.id,
      ...(input.supplier_id !== undefined && { supplier_id: input.supplier_id }),
      ...(input.stock_location_id !== undefined && {
        stock_location_id: input.stock_location_id,
      }),
      ...(input.currency_code !== undefined && {
        currency_code: input.currency_code,
      }),
      ...(input.expected_delivery !== undefined && {
        expected_delivery: input.expected_delivery
          ? new Date(input.expected_delivery)
          : null,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
      subtotal: totals.subtotal,
      tax_total: totals.tax_total,
      shipping_total: totals.shipping_total,
      total: totals.total,
    })

    const updated = (await purchaseOrderService.retrievePurchaseOrder(input.id, {
      relations: ["items"],
    })) as unknown as PurchaseOrderDTO

    return new StepResponse(updated, snapshot)
  },
  async (snapshot: UpdateSnapshot | undefined, { container }) => {
    if (!snapshot) {
      return
    }

    const purchaseOrderService: PurchaseOrderModuleService =
      container.resolve(PURCHASE_ORDER_MODULE)

    if (snapshot.previousItems) {
      const current = await purchaseOrderService.listPurchaseOrderLineItems({
        purchase_order_id: snapshot.id,
      })

      if (current.length) {
        await purchaseOrderService.deletePurchaseOrderLineItems(
          current.map((item) => item.id)
        )
      }

      await purchaseOrderService.createPurchaseOrderLineItems(
        snapshot.previousItems.map((item) => ({
          id: item.id,
          purchase_order_id: snapshot.id,
          inventory_item_id: item.inventory_item_id,
          variant_id: item.variant_id,
          title: item.title,
          sku: item.sku,
          quantity_ordered: item.quantity_ordered,
          quantity_received: item.quantity_received,
          unit_cost: item.unit_cost,
          line_total: item.line_total,
        }))
      )
    }

    await purchaseOrderService.updatePurchaseOrders({
      id: snapshot.id,
      ...snapshot.previous,
    })
  }
)

export const updatePurchaseOrderWorkflow = createWorkflow(
  "update-purchase-order",
  (input: UpdatePurchaseOrderInput) => {
    const purchaseOrder = updatePurchaseOrderStep(input)

    return new WorkflowResponse(purchaseOrder)
  }
)
