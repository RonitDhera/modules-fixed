import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { store_id } = req.query

  if (!store_id) {
    res.status(400).json({ success: false, message: "store_id is required" })
    return
  }

  try {
    // Directly query inventory levels without complex stock location entity links
    const { data: inventoryLevels } = await query.graph({
      entity: "inventory_level",
      fields: ["id", "stocked_quantity", "incoming_quantity", "location_id", "inventory_item_id"],
    })

    const lowStockThreshold = 5
    const lowStockItems = (inventoryLevels as any[]).filter(
      (item) => (item.stocked_quantity || 0) <= lowStockThreshold
    )

    res.json({
      success: true,
      threshold: lowStockThreshold,
      low_stock_count: lowStockItems.length,
      items: lowStockItems,
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message })
  }
}