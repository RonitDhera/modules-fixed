import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ANALYTICS_MODULE } from "../../../../modules/analytics"
import AnalyticsModuleService from "../../../../modules/analytics/service"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const analyticsModuleService: AnalyticsModuleService = req.scope.resolve(ANALYTICS_MODULE)
  const { from, to, store_id } = req.query

  if (!store_id) {
    res.status(400).json({ success: false, message: "store_id is required" })
    return
  }

  try {
    const filters: any = { store_id }

    if (from || to) {
      filters.date = {}
      if (from) filters.date.$gte = new Date(from as string)
      if (to) filters.date.$lte = new Date(to as string)
    }

    const snapshots = await analyticsModuleService.listAnalyticsSnapshots(filters)

    const totalRevenue = snapshots.reduce((sum, s) => sum + (s.revenue || 0), 0)
    const totalOrders = snapshots.reduce((sum, s) => sum + (s.orders_count || 0), 0)

    res.json({
      success: true,
      from: from || "all-time",
      to: to || "present",
      metrics: {
        revenue: totalRevenue,
        orders_count: totalOrders,
      },
      daily_breakdown: snapshots,
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message })
  }
}