import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GOOGLE_INTEGRATION_MODULE } from "../../../../modules/google-integration"
import GoogleIntegrationModuleService from "../../../../modules/google-integration/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const googleIntegrationService: GoogleIntegrationModuleService =
    req.scope.resolve(GOOGLE_INTEGRATION_MODULE)

  const { store_id } = req.query as { store_id: string }

  const [connection] = await googleIntegrationService.listGoogleConnections({
    store_id,
  })

  res.json({ connection: connection || null })
}