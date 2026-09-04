// src/modules/inventory-transfer/index.ts
import { Module } from "@medusajs/framework/utils"
import InventoryTransferModuleService from "./service"

export const INVENTORY_TRANSFER_MODULE = "inventory_transfer"

export default Module(INVENTORY_TRANSFER_MODULE, {
  service: InventoryTransferModuleService,
})