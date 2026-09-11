import { model } from "@medusajs/framework/utils"

// Stores one Google connection per store (multi-tenant)
const GoogleConnection = model.define("google_connection", {
  id: model.id().primaryKey(),
  store_id: model.text(), // which store this connection belongs to
  merchant_account_id: model.text().nullable(), // Google Merchant Center ID
  credentials: model.json().nullable(), // API keys / OAuth tokens for this store
  status: model
    .enum(["connected", "disconnected", "error"])
    .default("disconnected"),
  last_synced_at: model.dateTime().nullable(),
})

export default GoogleConnection