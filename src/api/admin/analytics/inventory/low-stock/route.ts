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
    // Step 1: get the store's default sales channel
    const { data: storesData } = await query.graph({
      entity: "store",
      filters: { id: store_id as string },
      fields: ["id", "default_sales_channel_id"],
    })

    const store = (storesData[0] as any)
    if (!store?.default_sales_channel_id) {
      res.status(404).json({ success: false, message: "Store or sales channel not found" })
      return
    }

    // Step 2: get stock locations linked to that sales channel
    const { data: scLocations } = await query.graph({
      entity: "sales_channel_stock_location",
      filters: { sales_channel_id: store.default_sales_channel_id },
      fields: ["stock_location_id"],
    })

    const locationIds = (scLocations as any[]).map((l) => l.stock_location_id)

    if (locationIds.length === 0) {
      res.json({ success: true, threshold: 5, low_stock_count: 0, items: [] })
      return
    }

    // Step 3: get inventory levels for those locations
    const { data: inventoryLevels } = await query.graph({
      entity: "inventory_level",
      filters: { location_id: locationIds },
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