import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type PoTotalsLine = {
  quantity_ordered: number
  unit_cost: number
}

export type PoTotals = {
  subtotal: number
  tax_total: number
  shipping_total: number
  total: number
}

/** Guards against IEEE drift (0.1 * 3 = 0.30000000000000004) in money maths. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function lineTotal(quantity: number, unitCost: number): number {
  return roundMoney(quantity * unitCost)
}

export function calculateTotals(input: {
  items: PoTotalsLine[]
  tax_total?: number
  shipping_total?: number
}): PoTotals {
  const subtotal = roundMoney(
    input.items.reduce(
      (sum, item) => sum + lineTotal(item.quantity_ordered, item.unit_cost),
      0
    )
  )

  const tax_total = roundMoney(input.tax_total ?? 0)
  const shipping_total = roundMoney(input.shipping_total ?? 0)

  return {
    subtotal,
    tax_total,
    shipping_total,
    total: roundMoney(subtotal + tax_total + shipping_total),
  }
}

export const calculatePoTotalsStep = createStep(
  "calculate-po-totals",
  async (input: {
    items: PoTotalsLine[]
    tax_total?: number
    shipping_total?: number
  }) => {
    return new StepResponse(calculateTotals(input))
  }
)
