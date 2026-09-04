import { MedusaService } from "@medusajs/framework/utils"
import Supplier from "./models/supplier"
import PurchaseOrder from "./models/purchase-order"
import PurchaseOrderLineItem from "./models/purchase-order-line-item"

class PurchaseOrderModuleService extends MedusaService({
  Supplier,
  PurchaseOrder,
  PurchaseOrderLineItem,
}) {}

export default PurchaseOrderModuleService