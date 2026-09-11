import { Module } from "@medusajs/framework/utils"
import GoogleIntegrationModuleService from "./service"

export const GOOGLE_INTEGRATION_MODULE = "google_integration"

export default Module(GOOGLE_INTEGRATION_MODULE, {
  service: GoogleIntegrationModuleService,
})