import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ANALYTICS_MODULE } from "../../../../../modules/analytics"
import AnalyticsModuleService from "../../../../../modules/analytics/service"

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

    // Merge top_products json from each day's snapshot into one combined ranking
    const productMap: Record<string, { product_id: string; title: string; qty: number }> = {}

    for (const snapshot of snapshots) {
      const dayProducts = (snapshot.top_products || []) as any[]
      for (const p of dayProducts) {
        if (!productMap[p.product_id]) {
          productMap[p.product_id] = { product_id: p.product_id, title: p.title, qty: 0 }
        }
        productMap[p.product_id].qty += p.qty || 0
      }
    }

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)

    res.json({
      success: true,
      from: from || "all-time",
      to: to || "present",
      top_products: topProducts,
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message })
  }
}