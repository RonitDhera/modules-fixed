import { MedusaService } from "@medusajs/framework/utils"
import GoogleConnection from "./models/google-connection"
import { getGoogleAuthClient } from "./utils/google-auth"

class GoogleIntegrationModuleService extends MedusaService({
  GoogleConnection,
}) {
  // Pushes a single product to this store's Google Merchant Center account
  async pushProductToGoogle(storeId: string, product: any) {
    const [connection] = await this.listGoogleConnections({
      store_id: storeId,
    })

    if (!connection || connection.status !== "connected") {
      throw new Error(`No active Google connection found for store ${storeId}`)
    }

  const authClient = await getGoogleAuthClient(
  connection.credentials as Record<string, unknown> | string
)
    const accessToken = await authClient.getAccessToken()

    // Map the Medusa product into the Merchant API product format
    const merchantProduct = {
      offerId: product.id,
      title: product.title,
      description: product.description || "",
      link: `https://your-storefront.com/products/${product.handle}`,
      imageLink: product.thumbnail || "",
      contentLanguage: "en",
      targetCountry: "US",
      channel: "online",
      availability: "in stock",
      condition: "new",
      price: {
        value: (product.variants?.[0]?.prices?.[0]?.amount / 100).toFixed(2),
        currencyCode: product.variants?.[0]?.prices?.[0]?.currency_code?.toUpperCase() || "USD",
      },
    }

    // Call the Merchant API to insert/update the product
    const response = await fetch(
      `https://merchantapi.googleapis.com/products/v1beta/accounts/${connection.merchant_account_id}/products:insert`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(merchantProduct),
      }
    )

    const result = await response.json()

    if (!response.ok) {
      // Update connection status to error so the dashboard can show it later
      await this.updateGoogleConnections({
        id: connection.id,
        status: "error",
      })
      throw new Error(`Google Merchant API error: ${JSON.stringify(result)}`)
    }

    await this.updateGoogleConnections({
      id: connection.id,
      last_synced_at: new Date(),
    })

    return result
  }
}

export default GoogleIntegrationModuleService