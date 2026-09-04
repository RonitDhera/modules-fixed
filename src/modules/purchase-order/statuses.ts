import { MedusaError } from "@medusajs/framework/utils"

export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "submitted",
  "partially_received",
  "received",
  "canceled",
] as const

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number]

/**
 * Which statuses each action is allowed to run from.
 *
 * This is an allow-list rather than a block-list on purpose: blocking only the
 * terminal statuses lets illegal jumps through (a draft PO could be received
 * without ever being submitted).
 */
const ALLOWED_FROM = {
  update: ["draft"],
  submit: ["draft"],
  receive: ["submitted", "partially_received"],
  cancel: ["draft", "submitted", "partially_received"],
} as const satisfies Record<string, readonly PurchaseOrderStatus[]>

export type PurchaseOrderAction = keyof typeof ALLOWED_FROM

export function assertPurchaseOrderTransition(
  action: PurchaseOrderAction,
  current: PurchaseOrderStatus,
  poNumber: string
): void {
  const allowed = ALLOWED_FROM[action] as readonly PurchaseOrderStatus[]

  if (!allowed.includes(current)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Cannot ${action} purchase order ${poNumber} — it is "${current}". Allowed from: ${allowed.join(
        ", "
      )}.`
    )
  }
}
