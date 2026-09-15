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
  const { from, to } = req.query

  try {
    // Fetching orders using Medusa v2 Query tool
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "total", "created_at"],
    })

    // Calculate total revenue and order count
    const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0)
    const ordersCount = orders.length

    res.json({
      success: true,
      from: from || "all-time",
      to: to || "present",
      metrics: {
        revenue: totalRevenue,
        orders_count: ordersCount,
      },
      orders,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}