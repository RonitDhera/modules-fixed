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
    // Fetching line items to aggregate top-selling products
    const { data: lineItems } = await query.graph({
      entity: "line_item",
      fields: ["id", "title", "quantity", "variant_id"],
    })

    // Group and sum quantities by product variant/title
    const productSales: { [key: string]: { title: string; total_sold: number } } = {}

    lineItems.forEach((item: any) => {
      const key = item.title || "Unknown Product"
      if (!productSales[key]) {
        productSales[key] = { title: key, total_sold: 0 }
      }
      productSales[key].total_sold += item.quantity || 0
    })

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.total_sold - a.total_sold)
      .slice(0, 5) // Top 5 best-selling products

    res.json({
      success: true,
      top_products: topProducts,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}