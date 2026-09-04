import { ExecArgs, IInventoryService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

import { PURCHASE_ORDER_MODULE } from "../modules/purchase-order"
import PurchaseOrderModuleService from "../modules/purchase-order/service"
import { createInventoryTransferWorkflow } from "../workflows/inventory-transfer/create-inventory-transfer"
import { createPurchaseOrderWorkflow } from "../workflows/purchase-order/create-purchase-order"
import { createSupplierWorkflow } from "../workflows/purchase-order/supplier"

/**
 * Seeds one supplier, one draft PO and one draft transfer.
 *
 * Everything goes through the same workflows the admin uses, so the demo data
 * gets real generated document numbers and server-calculated totals rather
 * than hand-written ones.
 */
export default async function seedPurchaseOrders({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const purchaseOrderService: PurchaseOrderModuleService =
    container.resolve(PURCHASE_ORDER_MODULE)
  const inventoryService: IInventoryService = container.resolve(Modules.INVENTORY)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)

  const existingSuppliers = await purchaseOrderService.listSuppliers({
    name: "Acme Textiles Ltd.",
  })

  if (existingSuppliers.length) {
    logger.info("Seed data already present — nothing to do.")
    return
  }

  const locations = await stockLocationService.listStockLocations({})

  if (!locations.length) {
    logger.warn(
      "No stock locations exist. Run the default Medusa seed first, then re-run this script."
    )
    return
  }

  const inventoryItems = await inventoryService.listInventoryItems(
    {},
    { take: 2 }
  )

  if (!inventoryItems.length) {
    logger.warn(
      "No inventory items exist. Create a product with inventory first — both modules move stock against real inventory items."
    )
    return
  }

  const { result: supplier } = await createSupplierWorkflow(container).run({
    input: {
      name: "Acme Textiles Ltd.",
      email: "orders@acmetextiles.com",
      phone: "+1-555-0100",
      address: "123 Industrial Ave",
      currency_code: "usd",
      notes: "Seeded sample supplier",
    },
  })

  const { result: purchaseOrder } = await createPurchaseOrderWorkflow(
    container
  ).run({
    input: {
      supplier_id: supplier.id,
      stock_location_id: locations[0].id,
      currency_code: "usd",
      notes: "Seeded sample purchase order",
      items: inventoryItems.map((item, index) => ({
        inventory_item_id: item.id,
        title: item.title ?? item.sku ?? `Item ${index + 1}`,
        sku: item.sku ?? null,
        quantity_ordered: (index + 1) * 25,
        unit_cost: (index + 1) * 5,
      })),
    },
  })

  logger.info(
    `Seeded supplier ${supplier.name} and purchase order ${purchaseOrder.po_number} (total ${purchaseOrder.total}).`
  )

  if (locations.length < 2) {
    logger.warn(
      "Only one stock location exists — skipping the sample transfer, which needs two."
    )
    return
  }

  const { result: transfer } = await createInventoryTransferWorkflow(
    container
  ).run({
    input: {
      from_location_id: locations[0].id,
      to_location_id: locations[1].id,
      notes: "Seeded sample inventory transfer",
      items: [
        {
          inventory_item_id: inventoryItems[0].id,
          title: inventoryItems[0].title ?? inventoryItems[0].sku ?? "Item 1",
          sku: inventoryItems[0].sku ?? null,
          quantity_requested: 15,
        },
      ],
    },
  })

  logger.info(`Seeded inventory transfer ${transfer.transfer_number}.`)

  if (transfer.availability_warnings.length) {
    logger.warn(
      `The source location is short on: ${transfer.availability_warnings
        .map((warning) => warning.title)
        .join(", ")}. Shipping will be blocked until stock is available.`
    )
  }

  logger.info("Seed complete.")
}
