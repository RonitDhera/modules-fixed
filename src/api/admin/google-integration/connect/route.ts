import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GOOGLE_INTEGRATION_MODULE } from "../../../../modules/google-integration"
import GoogleIntegrationModuleService from "../../../../modules/google-integration/service"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const googleIntegrationService: GoogleIntegrationModuleService =
    req.scope.resolve(GOOGLE_INTEGRATION_MODULE)

  const { store_id, merchant_account_id, credentials } = req.body as {
    store_id: string
    merchant_account_id: string
    credentials: Record<string, unknown>
  }

  // Check if a connection already exists for this store
  const [existing] = await googleIntegrationService.listGoogleConnections({
    store_id,
  })

  let connection
  if (existing) {
    // Update the existing row instead of creating a duplicate
    connection = await googleIntegrationService.updateGoogleConnections({
      id: existing.id,
      merchant_account_id,
      credentials,
      status: "connected",
    })
  } else {
    connection = await googleIntegrationService.createGoogleConnections({
      store_id,
      merchant_account_id,
      credentials,
      status: "connected",
    })
  }

  res.json({ connection })
}