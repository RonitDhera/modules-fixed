import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { IInventoryService, IStockLocationService } from "@medusajs/framework/types"

import { getAdminHeaders, RequestConfig } from "../helpers/admin"

jest.setTimeout(120000)

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("Purchase Orders", () => {
      let headers: RequestConfig
      let supplierId: string
      let stockLocationId: string
      let inventoryItemId: string

      /** Stocked quantity for the test item at the PO's location. */
      const stockedQuantity = async (locationId = stockLocationId) => {
        const inventoryService: IInventoryService = getContainer().resolve(
          Modules.INVENTORY
        )

        const levels = await inventoryService.listInventoryLevels({
          inventory_item_id: inventoryItemId,
          location_id: locationId,
        })

        return levels.length ? Number(levels[0].stocked_quantity) : 0
      }

      const createPo = async (
        overrides: Record<string, unknown> = {},
        quantity = 10,
        unitCost = 5
      ) => {
        const res = await api.post(
          "/admin/purchase-orders",
          {
            supplier_id: supplierId,
            stock_location_id: stockLocationId,
            currency_code: "usd",
            items: [
              {
                inventory_item_id: inventoryItemId,
                title: "Test Item",
                sku: "TEST-SKU",
                quantity_ordered: quantity,
                unit_cost: unitCost,
              },
            ],
            ...overrides,
          },
          headers
        )

        return res.data.purchase_order
      }

      beforeAll(async () => {
        const container = getContainer()

        const stockLocationService: IStockLocationService = container.resolve(
          Modules.STOCK_LOCATION
        )
        const inventoryService: IInventoryService = container.resolve(
          Modules.INVENTORY
        )

        const location = await stockLocationService.createStockLocations({
          name: "PO Test Warehouse",
        })
        stockLocationId = location.id

        const inventoryItem = await inventoryService.createInventoryItems({
          sku: "TEST-SKU",
          title: "Test Item",
        })
        inventoryItemId = inventoryItem.id
      })

      beforeEach(async () => {
        headers = await getAdminHeaders(api, getContainer())

        const supplierRes = await api.post(
          "/admin/suppliers",
          {
            name: `Supplier ${Date.now()}`,
            email: "orders@example.com",
            currency_code: "usd",
          },
          headers
        )

        supplierId = supplierRes.data.supplier.id
      })

      it("creates a PO with server-calculated totals and an auto PO number", async () => {
        const res = await api.post(
          "/admin/purchase-orders",
          {
            supplier_id: supplierId,
            stock_location_id: stockLocationId,
            currency_code: "usd",
            tax_total: 3,
            shipping_total: 7,
            // A wrong client-side total must be ignored.
            subtotal: 99999,
            total: 99999,
            items: [
              {
                inventory_item_id: inventoryItemId,
                title: "Test Item",
                sku: "TEST-SKU",
                quantity_ordered: 10,
                unit_cost: 5,
              },
            ],
          },
          headers
        )

        expect(res.status).toBe(201)

        const po = res.data.purchase_order
        expect(po.status).toBe("draft")
        expect(po.po_number).toMatch(/^PO-\d+$/)
        expect(Number(po.subtotal)).toBe(50)
        expect(Number(po.total)).toBe(60)
        expect(po.items).toHaveLength(1)
      })

      it("rejects a PO with no supplier, no lines, or a bad quantity", async () => {
        await expect(
          api.post(
            "/admin/purchase-orders",
            { stock_location_id: stockLocationId, currency_code: "usd", items: [] },
            headers
          )
        ).rejects.toMatchObject({ response: { status: 400 } })

        await expect(
          api.post(
            "/admin/purchase-orders",
            {
              supplier_id: supplierId,
              stock_location_id: stockLocationId,
              currency_code: "usd",
              items: [
                {
                  inventory_item_id: inventoryItemId,
                  title: "Test Item",
                  quantity_ordered: -5,
                  unit_cost: 5,
                },
              ],
            },
            headers
          )
        ).rejects.toMatchObject({ response: { status: 400 } })
      })

      it("issues a distinct PO number for every create", async () => {
        const first = await createPo()
        const second = await createPo()

        expect(first.po_number).not.toBe(second.po_number)

        const third = await createPo()
        expect(third.po_number).not.toBe(second.po_number)
        expect(third.po_number).not.toBe(first.po_number)
      })

      it("blocks submitting twice, and blocks receiving a draft", async () => {
        const po = await createPo()

        // A draft has not been submitted — receiving it is an illegal jump.
        await expect(
          api.post(
            `/admin/purchase-orders/${po.id}/receive`,
            { lines: [{ line_item_id: po.items[0].id, quantity_received: 1 }] },
            headers
          )
        ).rejects.toMatchObject({ response: { status: 400 } })

        const submitted = await api.post(
          `/admin/purchase-orders/${po.id}/submit`,
          {},
          headers
        )
        expect(submitted.data.purchase_order.status).toBe("submitted")

        await expect(
          api.post(`/admin/purchase-orders/${po.id}/submit`, {}, headers)
        ).rejects.toMatchObject({ response: { status: 400 } })
      })

      it("raises stock at the location on partial then full receipt", async () => {
        const po = await createPo({}, 10, 2)
        const lineItemId = po.items[0].id

        await api.post(`/admin/purchase-orders/${po.id}/submit`, {}, headers)

        const before = await stockedQuantity()

        const partial = await api.post(
          `/admin/purchase-orders/${po.id}/receive`,
          { lines: [{ line_item_id: lineItemId, quantity_received: 6 }] },
          headers
        )

        expect(partial.data.purchase_order.status).toBe("partially_received")
        expect(await stockedQuantity()).toBe(before + 6)

        // Receiving more than is outstanding is refused, and moves no stock.
        await expect(
          api.post(
            `/admin/purchase-orders/${po.id}/receive`,
            { lines: [{ line_item_id: lineItemId, quantity_received: 100 }] },
            headers
          )
        ).rejects.toMatchObject({ response: { status: 400 } })

        expect(await stockedQuantity()).toBe(before + 6)

        const full = await api.post(
          `/admin/purchase-orders/${po.id}/receive`,
          { lines: [{ line_item_id: lineItemId, quantity_received: 4 }] },
          headers
        )

        expect(full.data.purchase_order.status).toBe("received")
        expect(await stockedQuantity()).toBe(before + 10)
      })

      it("keeps totals when an update does not resend the line items", async () => {
        const po = await createPo({}, 10, 5)
        expect(Number(po.total)).toBe(50)

        const updated = await api.post(
          `/admin/purchase-orders/${po.id}`,
          { notes: "Call the supplier before delivery" },
          headers
        )

        expect(updated.data.purchase_order.notes).toBe(
          "Call the supplier before delivery"
        )
        expect(Number(updated.data.purchase_order.subtotal)).toBe(50)
        expect(Number(updated.data.purchase_order.total)).toBe(50)
      })

      it("blocks cancel once stock has been received, allows it before", async () => {
        const cancelable = await createPo()
        const canceled = await api.post(
          `/admin/purchase-orders/${cancelable.id}/cancel`,
          {},
          headers
        )
        expect(canceled.data.purchase_order.status).toBe("canceled")

        const received = await createPo()
        await api.post(
          `/admin/purchase-orders/${received.id}/submit`,
          {},
          headers
        )
        await api.post(
          `/admin/purchase-orders/${received.id}/receive`,
          { lines: [{ line_item_id: received.items[0].id, quantity_received: 1 }] },
          headers
        )

        await expect(
          api.post(`/admin/purchase-orders/${received.id}/cancel`, {}, headers)
        ).rejects.toMatchObject({ response: { status: 400 } })
      })

      it("filters and paginates the list", async () => {
        await createPo()
        const submitted = await createPo()
        await api.post(
          `/admin/purchase-orders/${submitted.id}/submit`,
          {},
          headers
        )

        const draftsOnly = await api.get(
          `/admin/purchase-orders?status=draft&supplier_id=${supplierId}`,
          headers
        )

        expect(draftsOnly.data.purchase_orders.length).toBeGreaterThan(0)
        expect(
          draftsOnly.data.purchase_orders.every(
            (po: { status: string }) => po.status === "draft"
          )
        ).toBe(true)

        const paged = await api.get(
          "/admin/purchase-orders?limit=1&offset=0",
          headers
        )
        expect(paged.data.purchase_orders).toHaveLength(1)
        expect(paged.data.limit).toBe(1)

        const searched = await api.get(
          `/admin/purchase-orders?q=${submitted.po_number}`,
          headers
        )
        expect(searched.data.purchase_orders[0].po_number).toBe(
          submitted.po_number
        )
      })
    })
  },
})

