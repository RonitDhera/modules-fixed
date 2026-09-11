import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GOOGLE_INTEGRATION_MODULE } from "../../../../modules/google-integration"
import GoogleIntegrationModuleService from "../../../../modules/google-integration/service"
import { Modules } from "@medusajs/framework/utils"

// POST /admin/google-integration/sync-product
// Body: { store_id, product_id }
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const googleIntegrationService: GoogleIntegrationModuleService =
    req.scope.resolve(GOOGLE_INTEGRATION_MODULE)
  const productModuleService = req.scope.resolve(Modules.PRODUCT)

  const { store_id, product_id } = req.body as {
    store_id: string
    product_id: string
  }

  const product = await productModuleService.retrieveProduct(product_id, {
    relations: ["variants", "variants.prices"],
  })

  const result = await googleIntegrationService.pushProductToGoogle(
    store_id,
    product
  )

  res.json({ success: true, result })
}