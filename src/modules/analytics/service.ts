import { MedusaService } from "@medusajs/framework/utils"
import { AnalyticsSnapshot } from "./models/analytics-snapshot"

class AnalyticsModuleService extends MedusaService({
  AnalyticsSnapshot,
}) {

}

export default AnalyticsModuleService