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

import { INVENTORY_TRANSFER_MODULE } from "../../modules/inventory-transfer"
import InventoryTransferModuleService from "../../modules/inventory-transfer/service"
import { InventoryTransferDTO } from "../../modules/inventory-transfer/types"
import {
  nextDocumentNumber,
  withDocumentNumberRetry,
} from "../common/document-number"
import { getAvailableQuantity } from "../common/inventory-steps"

export type CreateInventoryTransferLineInput = {
  inventory_item_id: string
  variant_id?: string | null
  title: string
  sku?: string | null
  quantity_requested: number
}

export type CreateInventoryTransferInput = {
  from_location_id: string
  to_location_id: string
  notes?: string | null
  items: CreateInventoryTransferLineInput[]
}

export type CreateInventoryTransferResult = InventoryTransferDTO & {
  /** Lines whose requested quantity is more than the source currently holds. */
  availability_warnings: {
    inventory_item_id: string
    title: string
    requested: number
    available: number
  }[]
}

const validateTransferStep = createStep(
  "validate-inventory-transfer",
  async (input: CreateInventoryTransferInput, { container }) => {
    if (input.from_location_id === input.to_location_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Source and destination locations must be different."
      )
    }

    const stockLocationService: IStockLocationService = container.resolve(
      Modules.STOCK_LOCATION
    )
    const inventoryService: IInventoryService = container.resolve(
      Modules.INVENTORY
    )

    const locationIds = [input.from_location_id, input.to_location_id]

    const locations = await stockLocationService.listStockLocations({
      id: locationIds,
    })

    if (locations.length !== locationIds.length) {
      const found = new Set(locations.map((location) => location.id))
      const missing = locationIds.filter((id) => !found.has(id))

      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Unknown stock location(s): ${missing.join(", ")}.`
      )
    }

    const itemIds = [...new Set(input.items.map((item) => item.inventory_item_id))]

    const inventoryItems = await inventoryService.listInventoryItems({
      id: itemIds,
    })

    if (inventoryItems.length !== itemIds.length) {
      const found = new Set(inventoryItems.map((item) => item.id))
      const missing = itemIds.filter((id) => !found.has(id))

      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Unknown inventory item(s): ${missing.join(", ")}.`
      )
    }

    /*
     * The brief asks for a warning, not a hard failure: a transfer is often
     * drafted before the stock lands. Shipping is what enforces availability.
     */
    const availability_warnings: CreateInventoryTransferResult["availability_warnings"] =
      []

    for (const item of input.items) {
      const available = await getAvailableQuantity(
        inventoryService,
        item.inventory_item_id,
        input.from_location_id
      )

      if (available < item.quantity_requested) {
        availability_warnings.push({
          inventory_item_id: item.inventory_item_id,
          title: item.title,
          requested: item.quantity_requested,
          available,
        })
      }
    }

    return new StepResponse({ availability_warnings })
  }
)

const createInventoryTransferRecordStep = createStep(
  "create-inventory-transfer-record",
  async (input: CreateInventoryTransferInput, { container }) => {
    const transferService: InventoryTransferModuleService = container.resolve(
      INVENTORY_TRANSFER_MODULE
    )

    const generate = async (): Promise<string> => {
      const existing = await transferService.listInventoryTransfers(
        {},
        { select: ["transfer_number"] }
      )

      return nextDocumentNumber(
        "TR",
        existing.map((transfer) => transfer.transfer_number)
      )
    }

    /*
     * The parent and its lines are created in two calls: the generated
     * `createInventoryTransfers` takes related ids, not nested line objects.
     */
    const created = await withDocumentNumberRetry(
      (transferNumber) =>
        transferService.createInventoryTransfers({
          transfer_number: transferNumber,
          from_location_id: input.from_location_id,
          to_location_id: input.to_location_id,
          notes: input.notes ?? null,
          status: "draft",
        }),
      generate
    )

    await transferService.createInventoryTransferLineItems(
      input.items.map((item) => ({
        transfer_id: created.id,
        inventory_item_id: item.inventory_item_id,
        variant_id: item.variant_id ?? null,
        title: item.title,
        sku: item.sku ?? null,
        quantity_requested: item.quantity_requested,
        quantity_shipped: 0,
        quantity_received: 0,
      }))
    )

    const transfer = (await transferService.retrieveInventoryTransfer(
      created.id,
      { relations: ["items"] }
    )) as unknown as InventoryTransferDTO

    return new StepResponse(transfer, transfer.id)
  },
  async (transferId: string | undefined, { container }) => {
    if (!transferId) {
      return
    }

    const transferService: InventoryTransferModuleService = container.resolve(
      INVENTORY_TRANSFER_MODULE
    )

    // Lines first — they hold the foreign key back to the transfer.
    const lineItems = await transferService.listInventoryTransferLineItems({
      transfer_id: transferId,
    })

    if (lineItems.length) {
      await transferService.deleteInventoryTransferLineItems(
        lineItems.map((item) => item.id)
      )
    }

    await transferService.deleteInventoryTransfers([transferId])
  }
)

export const createInventoryTransferWorkflow = createWorkflow(
  "create-inventory-transfer",
  (input: CreateInventoryTransferInput) => {
    const validation = validateTransferStep(input)
    const transfer = createInventoryTransferRecordStep(input)

    const result = transform({ transfer, validation }, (data) => ({
      ...data.transfer,
      availability_warnings: data.validation.availability_warnings,
    }))

    return new WorkflowResponse(result)
  }
)
