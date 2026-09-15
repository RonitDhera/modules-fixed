import { 
  MedusaRequest, 
  MedusaResponse 
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    // Fetching inventory levels using Medusa v2 Query tool
    const { data: inventoryLevels } = await query.graph({
      entity: "inventory_level",
      fields: ["id", "stocked_quantity", "incoming_quantity", "location_id", "inventory_item_id"],
    })

    // Filter items with low stock (e.g., stocked_quantity <= 5)
    const lowStockThreshold = 5
    const lowStockItems = inventoryLevels.filter(
      (item: any) => (item.stocked_quantity || 0) <= lowStockThreshold
    )

    res.json({
      success: true,
      threshold: lowStockThreshold,
      low_stock_count: lowStockItems.length,
      items: lowStockItems,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}