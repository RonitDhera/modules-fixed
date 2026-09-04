import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  IInventoryService,
  IStockLocationService,
} from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"

import { PURCHASE_ORDER_MODULE } from "../../modules/purchase-order"
import PurchaseOrderModuleService from "../../modules/purchase-order/service"
import { PurchaseOrderDTO } from "../../modules/purchase-order/types"
import {
  nextDocumentNumber,
  withDocumentNumberRetry,
} from "../common/document-number"
import { calculatePoTotalsStep, lineTotal, PoTotals } from "./steps/calculate-po-totals"

export type CreatePurchaseOrderLineInput = {
  inventory_item_id: string
  variant_id?: string | null
  title: string
  sku?: string | null
  quantity_ordered: number
  unit_cost: number
}

export type CreatePurchaseOrderInput = {
  supplier_id: string
  stock_location_id: string
  currency_code: string
  expected_delivery?: string | null
  notes?: string | null
  tax_total?: number
  shipping_total?: number
  items: CreatePurchaseOrderLineInput[]
}

/**
 * Fails fast when the PO points at a supplier, location or inventory item that
 * does not exist. These are plain text columns, so nothing else would catch it.
 */
export const validatePurchaseOrderReferencesStep = createStep(
  "validate-purchase-order-references",
  async (
    input: { supplier_id: string; stock_location_id: string; inventory_item_ids: string[] },
    { container }
  ) => {
    const purchaseOrderService: PurchaseOrderModuleService =
      container.resolve(PURCHASE_ORDER_MODULE)
    const stockLocationService: IStockLocationService = container.resolve(
      Modules.STOCK_LOCATION
    )
    const inventoryService: IInventoryService = container.resolve(
      Modules.INVENTORY
    )

    // Throws NOT_FOUND (404) when the supplier does not exist.
    await purchaseOrderService.retrieveSupplier(input.supplier_id)

    const locations = await stockLocationService.listStockLocations({
      id: input.stock_location_id,
    })

    if (!locations.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Stock location ${input.stock_location_id} does not exist.`
      )
    }

    const uniqueItemIds = [...new Set(input.inventory_item_ids)]

    const inventoryItems = await inventoryService.listInventoryItems({
      id: uniqueItemIds,
    })

    if (inventoryItems.length !== uniqueItemIds.length) {
      const found = new Set(inventoryItems.map((item) => item.id))
      const missing = uniqueItemIds.filter((id) => !found.has(id))

      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Unknown inventory item(s): ${missing.join(", ")}.`
      )
    }

    return new StepResponse(void 0)
  }
)

const createPurchaseOrderRecordStep = createStep(
  "create-purchase-order-record",
  async (
    input: CreatePurchaseOrderInput & { totals: PoTotals },
    { container }
  ) => {
    const purchaseOrderService: PurchaseOrderModuleService =
      container.resolve(PURCHASE_ORDER_MODULE)

    const generate = async (): Promise<string> => {
      const existing = await purchaseOrderService.listPurchaseOrders(
        {},
        { select: ["po_number"] }
      )

      return nextDocumentNumber(
        "PO",
        existing.map((po) => po.po_number)
      )
    }

    /*
     * The parent and its lines are created in two calls: the generated
     * `createPurchaseOrders` takes related ids, not nested line objects.
     */
    const created = await withDocumentNumberRetry(
      (poNumber) =>
        purchaseOrderService.createPurchaseOrders({
          po_number: poNumber,
          supplier_id: input.supplier_id,
          stock_location_id: input.stock_location_id,
          currency_code: input.currency_code,
          expected_delivery: input.expected_delivery
            ? new Date(input.expected_delivery)
            : null,
          notes: input.notes ?? null,
          status: "draft",
          subtotal: input.totals.subtotal,
          tax_total: input.totals.tax_total,
          shipping_total: input.totals.shipping_total,
          total: input.totals.total,
        }),
      generate
    )

    await purchaseOrderService.createPurchaseOrderLineItems(
      input.items.map((item) => ({
        purchase_order_id: created.id,
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

    const purchaseOrder = (await purchaseOrderService.retrievePurchaseOrder(
      created.id,
      { relations: ["items"] }
    )) as unknown as PurchaseOrderDTO

    return new StepResponse(purchaseOrder, purchaseOrder.id)
  },
  async (purchaseOrderId: string | undefined, { container }) => {
    if (!purchaseOrderId) {
      return
    }

    const purchaseOrderService: PurchaseOrderModuleService =
      container.resolve(PURCHASE_ORDER_MODULE)

    // Lines first — they hold the foreign key back to the PO.
    const lineItems = await purchaseOrderService.listPurchaseOrderLineItems({
      purchase_order_id: purchaseOrderId,
    })

    if (lineItems.length) {
      await purchaseOrderService.deletePurchaseOrderLineItems(
        lineItems.map((item) => item.id)
      )
    }

    await purchaseOrderService.deletePurchaseOrders([purchaseOrderId])
  }
)

export const createPurchaseOrderWorkflow = createWorkflow(
  "create-purchase-order",
  (input: CreatePurchaseOrderInput) => {
    validatePurchaseOrderReferencesStep(
      transform({ input }, (data) => ({
        supplier_id: data.input.supplier_id,
        stock_location_id: data.input.stock_location_id,
        inventory_item_ids: data.input.items.map(
          (item) => item.inventory_item_id
        ),
      }))
    )

    const totals = calculatePoTotalsStep(
      transform({ input }, (data) => ({
        items: data.input.items,
        tax_total: data.input.tax_total,
        shipping_total: data.input.shipping_total,
      }))
    )

    const purchaseOrder = createPurchaseOrderRecordStep(
      transform({ input, totals }, (data) => ({
        ...data.input,
        totals: data.totals,
      }))
    )

    return new WorkflowResponse(purchaseOrder)
  }
)
