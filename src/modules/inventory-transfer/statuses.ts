import { MedusaError } from "@medusajs/framework/utils"

export const INVENTORY_TRANSFER_STATUSES = [
  "draft",
  "requested",
  "in_transit",
  "received",
  "canceled",
] as const

export type InventoryTransferStatus =
  (typeof INVENTORY_TRANSFER_STATUSES)[number]

/**
 * Which statuses each action is allowed to run from.
 *
 * `ship` is allowed from `in_transit` so a partially shipped transfer can send
 * the rest of its lines — otherwise the first partial shipment strands it.
 */
const ALLOWED_FROM = {
  update: ["draft"],
  request: ["draft"],
  ship: ["draft", "requested", "in_transit"],
  receive: ["in_transit"],
  cancel: ["draft", "requested", "in_transit"],
} as const satisfies Record<string, readonly InventoryTransferStatus[]>

export type InventoryTransferAction = keyof typeof ALLOWED_FROM

export function assertInventoryTransferTransition(
  action: InventoryTransferAction,
  current: InventoryTransferStatus,
  transferNumber: string
): void {
  const allowed = ALLOWED_FROM[action] as readonly InventoryTransferStatus[]

  if (!allowed.includes(current)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Cannot ${action} transfer ${transferNumber} — it is "${current}". Allowed from: ${allowed.join(
        ", "
      )}.`
    )
  }
}
