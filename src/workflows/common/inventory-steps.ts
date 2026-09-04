import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { IInventoryService } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"

/** A signed change to one inventory item at one stock location. */
export type InventoryAdjustment = {
  inventory_item_id: string
  location_id: string
  /** Positive to increase stocked quantity, negative to decrease. */
  adjustment: number
}

export type InventoryLevelRef = {
  inventory_item_id: string
  location_id: string
}

/**
 * Makes sure an inventory level row exists for every (item, location) pair.
 *
 * `adjustInventory` throws when no level exists yet, which is a normal state
 * for the first receipt into a new stock location. Levels created here are
 * removed again by the compensation so a failed workflow leaves no trace.
 */
export const ensureInventoryLevelsStep = createStep(
  "ensure-inventory-levels",
  async (input: { levels: InventoryLevelRef[] }, { container }) => {
    const inventoryService: IInventoryService = container.resolve(
      Modules.INVENTORY
    )

    const created: InventoryLevelRef[] = []

    for (const level of input.levels) {
      const existing = await inventoryService.listInventoryLevels({
        inventory_item_id: level.inventory_item_id,
        location_id: level.location_id,
      })

      if (existing.length) {
        continue
      }

      await inventoryService.createInventoryLevels([
        {
          inventory_item_id: level.inventory_item_id,
          location_id: level.location_id,
          stocked_quantity: 0,
        },
      ])

      created.push(level)
    }

    return new StepResponse(created, created)
  },
  async (created: InventoryLevelRef[] | undefined, { container }) => {
    if (!created?.length) {
      return
    }

    const inventoryService: IInventoryService = container.resolve(
      Modules.INVENTORY
    )

    for (const level of created) {
      const levels = await inventoryService.listInventoryLevels({
        inventory_item_id: level.inventory_item_id,
        location_id: level.location_id,
      })

      if (levels.length) {
        await inventoryService.deleteInventoryLevels([levels[0].id])
      }
    }
  }
)

/**
 * Applies every stock movement for one operation, and is the only place in
 * either module that touches stock.
 *
 * Two separate rollback paths, because they cover different failures:
 *
 *  - The inner try/catch reverses adjustments already applied when a later one
 *    in the same batch fails. A step's own compensation does NOT run when the
 *    step itself throws, so without this a half-applied batch would stick.
 *  - The compensation function reverses the whole batch when a *later* step in
 *    the workflow fails (for example persisting the receipt).
 */
export const adjustInventoryStep = createStep(
  "adjust-inventory",
  async (input: { adjustments: InventoryAdjustment[] }, { container }) => {
    const inventoryService: IInventoryService = container.resolve(
      Modules.INVENTORY
    )

    const applied: InventoryAdjustment[] = []

    try {
      for (const adjustment of input.adjustments) {
        await inventoryService.adjustInventory(
          adjustment.inventory_item_id,
          adjustment.location_id,
          adjustment.adjustment
        )

        applied.push(adjustment)
      }
    } catch (error) {
      for (const done of [...applied].reverse()) {
        await inventoryService.adjustInventory(
          done.inventory_item_id,
          done.location_id,
          -done.adjustment
        )
      }

      throw error
    }

    return new StepResponse(applied, applied)
  },
  async (applied: InventoryAdjustment[] | undefined, { container }) => {
    if (!applied?.length) {
      return
    }

    const inventoryService: IInventoryService = container.resolve(
      Modules.INVENTORY
    )

    for (const adjustment of [...applied].reverse()) {
      await inventoryService.adjustInventory(
        adjustment.inventory_item_id,
        adjustment.location_id,
        -adjustment.adjustment
      )
    }
  }
)

/**
 * Available = stocked - reserved, at one location. Returns 0 when the item has
 * no level at that location yet.
 */
export async function getAvailableQuantity(
  inventoryService: IInventoryService,
  inventoryItemId: string,
  locationId: string
): Promise<number> {
  const levels = await inventoryService.listInventoryLevels({
    inventory_item_id: inventoryItemId,
    location_id: locationId,
  })

  if (!levels.length) {
    return 0
  }

  return levels.reduce(
    (sum, level) =>
      sum + (Number(level.stocked_quantity) - Number(level.reserved_quantity)),
    0
  )
}

/** Throws INVALID_DATA when a decrement would drive a location negative. */
export async function assertSufficientStock(
  inventoryService: IInventoryService,
  inventoryItemId: string,
  locationId: string,
  requiredQuantity: number,
  itemLabel: string
): Promise<void> {
  const available = await getAvailableQuantity(
    inventoryService,
    inventoryItemId,
    locationId
  )

  if (available < requiredQuantity) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Not enough stock for "${itemLabel}" at the source location — ${available} available, ${requiredQuantity} requested.`
    )
  }
}
