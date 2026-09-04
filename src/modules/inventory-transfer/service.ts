// src/modules/inventory-transfer/service.ts
import { MedusaService } from "@medusajs/framework/utils"
import InventoryTransfer from "./models/inventory-transfer"
import InventoryTransferLineItem from "./models/inventory-transfer-line-item"

class InventoryTransferModuleService extends MedusaService({
  InventoryTransfer,
  InventoryTransferLineItem,
}) {}

export default InventoryTransferModuleService