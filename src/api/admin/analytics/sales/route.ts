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
    // Fetching orders with summary fields in Medusa v2
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "created_at", "summary.*"],
    })

    // Calculate total revenue from summary.total and order count
    const totalRevenue = orders.reduce((sum: number, order: any) => {
      const orderTotal = order.summary?.total ?? order.total ?? 0
      return sum + orderTotal
    }, 0)
    
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