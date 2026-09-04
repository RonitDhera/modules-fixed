import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"

import { INVENTORY_TRANSFER_MODULE } from "../../modules/inventory-transfer"
import InventoryTransferModuleService from "../../modules/inventory-transfer/service"
import { assertInventoryTransferTransition } from "../../modules/inventory-transfer/statuses"
import {
  InventoryTransferDTO,
  InventoryTransferLineItemDTO,
} from "../../modules/inventory-transfer/types"

export type UpdateInventoryTransferLineInput = {
  inventory_item_id: string
  variant_id?: string | null
  title: string
  sku?: string | null
  quantity_requested: number
}

export type UpdateInventoryTransferInput = {
  id: string
  from_location_id?: string
  to_location_id?: string
  notes?: string | null
  /** Omit entirely to leave the existing lines alone. */
  items?: UpdateInventoryTransferLineInput[]
}

type UpdateSnapshot = {
  id: string
  previous: {
    from_location_id: string
    to_location_id: string
    notes: string | null
  }
  previousItems: InventoryTransferLineItemDTO[] | null
}

const updateInventoryTransferStep = createStep(
  "update-inventory-transfer-step",
  async (input: UpdateInventoryTransferInput, { container }) => {
    const transferService: InventoryTransferModuleService = container.resolve(
      INVENTORY_TRANSFER_MODULE
    )

    const existing = (await transferService.retrieveInventoryTransfer(input.id, {
      relations: ["items"],
    })) as unknown as InventoryTransferDTO

    assertInventoryTransferTransition(
      "update",
      existing.status,
      existing.transfer_number
    )

    const from = input.from_location_id ?? existing.from_location_id
    const to = input.to_location_id ?? existing.to_location_id

    if (from === to) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Source and destination locations must be different."
      )
    }

    const snapshot: UpdateSnapshot = {
      id: input.id,
      previous: {
        from_location_id: existing.from_location_id,
        to_location_id: existing.to_location_id,
        notes: existing.notes,
      },
      previousItems: input.items ? existing.items : null,
    }

    if (input.items) {
      if (existing.items.length) {
        await transferService.deleteInventoryTransferLineItems(
          existing.items.map((item) => item.id)
        )
      }

      await transferService.createInventoryTransferLineItems(
        input.items.map((item) => ({
          transfer_id: input.id,
          inventory_item_id: item.inventory_item_id,
          variant_id: item.variant_id ?? null,
          title: item.title,
          sku: item.sku ?? null,
          quantity_requested: item.quantity_requested,
          quantity_shipped: 0,
          quantity_received: 0,
        }))
      )
    }

    await transferService.updateInventoryTransfers({
      id: input.id,
      ...(input.from_location_id !== undefined && {
        from_location_id: input.from_location_id,
      }),
      ...(input.to_location_id !== undefined && {
        to_location_id: input.to_location_id,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
    })

    const updated = (await transferService.retrieveInventoryTransfer(input.id, {
      relations: ["items"],
    })) as unknown as InventoryTransferDTO

    return new StepResponse(updated, snapshot)
  },
  async (snapshot: UpdateSnapshot | undefined, { container }) => {
    if (!snapshot) {
      return
    }

    const transferService: InventoryTransferModuleService = container.resolve(
      INVENTORY_TRANSFER_MODULE
    )

    if (snapshot.previousItems) {
      const current = await transferService.listInventoryTransferLineItems({
        transfer_id: snapshot.id,
      })

      if (current.length) {
        await transferService.deleteInventoryTransferLineItems(
          current.map((item) => item.id)
        )
      }

      await transferService.createInventoryTransferLineItems(
        snapshot.previousItems.map((item) => ({
          id: item.id,
          transfer_id: snapshot.id,
          inventory_item_id: item.inventory_item_id,
          variant_id: item.variant_id,
          title: item.title,
          sku: item.sku,
          quantity_requested: item.quantity_requested,
          quantity_shipped: item.quantity_shipped,
          quantity_received: item.quantity_received,
        }))
      )
    }

    await transferService.updateInventoryTransfers({
      id: snapshot.id,
      ...snapshot.previous,
    })
  }
)

export const updateInventoryTransferWorkflow = createWorkflow(
  "update-inventory-transfer",
  (input: UpdateInventoryTransferInput) => {
    const transfer = updateInventoryTransferStep(input)

    return new WorkflowResponse(transfer)
  }
)
