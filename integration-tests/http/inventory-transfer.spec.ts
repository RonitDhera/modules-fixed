import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  IInventoryService,
  IStockLocationService,
} from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

import { getAdminHeaders, RequestConfig } from "../helpers/admin"

jest.setTimeout(120000)

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("Inventory Transfers", () => {
      let headers: RequestConfig
      let sourceLocationId: string
      let destinationLocationId: string
      let inventoryItemId: string

      const stockedQuantity = async (locationId: string) => {
        const inventoryService: IInventoryService = getContainer().resolve(
          Modules.INVENTORY
        )

        const levels = await inventoryService.listInventoryLevels({
          inventory_item_id: inventoryItemId,
          location_id: locationId,
        })

        return levels.length ? Number(levels[0].stocked_quantity) : 0
      }

      const setSourceStock = async (quantity: number) => {
        const inventoryService: IInventoryService = getContainer().resolve(
          Modules.INVENTORY
        )

        await inventoryService.updateInventoryLevels([
          {
            inventory_item_id: inventoryItemId,
            location_id: sourceLocationId,
            stocked_quantity: quantity,
          },
        ])
      }

      const createTransfer = async (quantity = 10) => {
        const res = await api.post(
          "/admin/inventory-transfers",
          {
            from_location_id: sourceLocationId,
            to_location_id: destinationLocationId,
            items: [
              {
                inventory_item_id: inventoryItemId,
                title: "Transfer Item",
                sku: "TR-SKU",
                quantity_requested: quantity,
              },
            ],
          },
          headers
        )

        return res.data.transfer
      }

      beforeAll(async () => {
        const container = getContainer()

        const stockLocationService: IStockLocationService = container.resolve(
          Modules.STOCK_LOCATION
        )
        const inventoryService: IInventoryService = container.resolve(
          Modules.INVENTORY
        )

        const source = await stockLocationService.createStockLocations({
          name: "Transfer Source",
        })
        const destination = await stockLocationService.createStockLocations({
          name: "Transfer Destination",
        })

        sourceLocationId = source.id
        destinationLocationId = destination.id

        const item = await inventoryService.createInventoryItems({
          sku: "TR-SKU",
          title: "Transfer Item",
        })
        inventoryItemId = item.id

        await inventoryService.createInventoryLevels([
          {
            inventory_item_id: inventoryItemId,
            location_id: sourceLocationId,
            stocked_quantity: 0,
          },
        ])
      })

      beforeEach(async () => {
        headers = await getAdminHeaders(api, getContainer())
        await setSourceStock(100)
      })

      it("refuses a transfer between the same location", async () => {
        await expect(
          api.post(
            "/admin/inventory-transfers",
            {
              from_location_id: sourceLocationId,
              to_location_id: sourceLocationId,
              items: [
                {
                  inventory_item_id: inventoryItemId,
                  title: "Transfer Item",
                  quantity_requested: 1,
                },
              ],
            },
            headers
          )
        ).rejects.toMatchObject({ response: { status: 400 } })
      })

      it("moves stock from source to destination across ship then receive", async () => {
        const transfer = await createTransfer(10)
        const lineItemId = transfer.items[0].id

        const requested = await api.post(
          `/admin/inventory-transfers/${transfer.id}/request`,
          {},
          headers
        )
        expect(requested.data.transfer.status).toBe("requested")

        const sourceBefore = await stockedQuantity(sourceLocationId)
        const destinationBefore = await stockedQuantity(destinationLocationId)

        const shipped = await api.post(
          `/admin/inventory-transfers/${transfer.id}/ship`,
          { lines: [{ line_item_id: lineItemId, quantity_shipped: 10 }] },
          headers
        )

        expect(shipped.data.transfer.status).toBe("in_transit")
        expect(await stockedQuantity(sourceLocationId)).toBe(sourceBefore - 10)

        // In transit: it has left the source but has not arrived yet.
        expect(await stockedQuantity(destinationLocationId)).toBe(
          destinationBefore
        )

        const received = await api.post(
          `/admin/inventory-transfers/${transfer.id}/receive`,
          { lines: [{ line_item_id: lineItemId, quantity_received: 10 }] },
          headers
        )

        expect(received.data.transfer.status).toBe("received")
        expect(await stockedQuantity(destinationLocationId)).toBe(
          destinationBefore + 10
        )
        expect(await stockedQuantity(sourceLocationId)).toBe(sourceBefore - 10)
      })

      it("lets a partially shipped transfer ship the rest instead of stranding it", async () => {
        const transfer = await createTransfer(10)
        const lineItemId = transfer.items[0].id

        const firstLeg = await api.post(
          `/admin/inventory-transfers/${transfer.id}/ship`,
          { lines: [{ line_item_id: lineItemId, quantity_shipped: 4 }] },
          headers
        )
        expect(firstLeg.data.transfer.status).toBe("in_transit")

        // Receiving the first leg must not complete the transfer.
        const partialReceipt = await api.post(
          `/admin/inventory-transfers/${transfer.id}/receive`,
          { lines: [{ line_item_id: lineItemId, quantity_received: 4 }] },
          headers
        )
        expect(partialReceipt.data.transfer.status).toBe("in_transit")

        const secondLeg = await api.post(
          `/admin/inventory-transfers/${transfer.id}/ship`,
          { lines: [{ line_item_id: lineItemId, quantity_shipped: 6 }] },
          headers
        )
        expect(secondLeg.data.transfer.items[0].quantity_shipped).toBe(10)

        const finalReceipt = await api.post(
          `/admin/inventory-transfers/${transfer.id}/receive`,
          { lines: [{ line_item_id: lineItemId, quantity_received: 6 }] },
          headers
        )
        expect(finalReceipt.data.transfer.status).toBe("received")
      })

      it("refuses to receive more than was shipped", async () => {
        const transfer = await createTransfer(10)
        const lineItemId = transfer.items[0].id

        await api.post(
          `/admin/inventory-transfers/${transfer.id}/ship`,
          { lines: [{ line_item_id: lineItemId, quantity_shipped: 3 }] },
          headers
        )

        const destinationBefore = await stockedQuantity(destinationLocationId)

        await expect(
          api.post(
            `/admin/inventory-transfers/${transfer.id}/receive`,
            { lines: [{ line_item_id: lineItemId, quantity_received: 10 }] },
            headers
          )
        ).rejects.toMatchObject({ response: { status: 400 } })

        expect(await stockedQuantity(destinationLocationId)).toBe(
          destinationBefore
        )
      })

      it("refuses to ship more stock than the source holds", async () => {
        await setSourceStock(2)

        const transfer = await createTransfer(10)
        const lineItemId = transfer.items[0].id

        await expect(
          api.post(
            `/admin/inventory-transfers/${transfer.id}/ship`,
            { lines: [{ line_item_id: lineItemId, quantity_shipped: 10 }] },
            headers
          )
        ).rejects.toMatchObject({ response: { status: 400 } })

        expect(await stockedQuantity(sourceLocationId)).toBe(2)
      })

      it("closes a short shipment on request and records the shortage", async () => {
        const transfer = await createTransfer(10)
        const lineItemId = transfer.items[0].id

        await api.post(
          `/admin/inventory-transfers/${transfer.id}/ship`,
          { lines: [{ line_item_id: lineItemId, quantity_shipped: 7 }] },
          headers
        )

        const closed = await api.post(
          `/admin/inventory-transfers/${transfer.id}/receive`,
          {
            lines: [{ line_item_id: lineItemId, quantity_received: 7 }],
            discrepancy_notes: "Supplier short-shipped 3 units.",
            close_short: true,
          },
          headers
        )

        expect(closed.data.transfer.status).toBe("received")
        expect(closed.data.transfer.notes).toContain("short-shipped")
      })

      it("returns in-transit stock to source when a shipped transfer is canceled", async () => {
        const transfer = await createTransfer(10)
        const lineItemId = transfer.items[0].id

        const sourceBefore = await stockedQuantity(sourceLocationId)

        await api.post(
          `/admin/inventory-transfers/${transfer.id}/ship`,
          { lines: [{ line_item_id: lineItemId, quantity_shipped: 10 }] },
          headers
        )
        expect(await stockedQuantity(sourceLocationId)).toBe(sourceBefore - 10)

        // Receive part of it — only the balance should come back.
        await api.post(
          `/admin/inventory-transfers/${transfer.id}/receive`,
          { lines: [{ line_item_id: lineItemId, quantity_received: 4 }] },
          headers
        )

        const canceled = await api.post(
          `/admin/inventory-transfers/${transfer.id}/cancel`,
          {},
          headers
        )

        expect(canceled.data.transfer.status).toBe("canceled")
        expect(await stockedQuantity(sourceLocationId)).toBe(sourceBefore - 4)
      })

      it("filters the list by status and by location", async () => {
        const transfer = await createTransfer(1)

        const byStatus = await api.get(
          "/admin/inventory-transfers?status=draft",
          headers
        )
        expect(
          byStatus.data.transfers.every(
            (row: { status: string }) => row.status === "draft"
          )
        ).toBe(true)

        const byLocation = await api.get(
          `/admin/inventory-transfers?from_location_id=${sourceLocationId}`,
          headers
        )
        expect(
          byLocation.data.transfers.some(
            (row: { id: string }) => row.id === transfer.id
          )
        ).toBe(true)
      })
    })
  },
})
