import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Table } from "@medusajs/ui"
import { ChatBubbleLeftRight } from "@medusajs/icons"
import { useEffect, useState } from "react"

const AnalyticsPage = () => {
  const [salesData, setSalesData] = useState<any>(null)
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [lowStockData, setLowStockData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Step 1: get the current store's id first
    fetch("/admin/stores", { credentials: "include" })
      .then((res) => res.json())
      .then((storeRes) => {
        const store_id = storeRes?.stores?.[0]?.id
        if (!store_id) {
          console.error("No store found")
          setLoading(false)
          return
        }

        // Step 2: now call the three analytics endpoints with store_id
        Promise.all([
          fetch(`/admin/analytics/sales?store_id=${store_id}`, { credentials: "include" }).then((res) => res.json()),
          fetch(`/admin/analytics/products/top?store_id=${store_id}`, { credentials: "include" }).then((res) => res.json()),
          fetch(`/admin/analytics/inventory/low-stock?store_id=${store_id}`, { credentials: "include" }).then((res) => res.json()),
        ])
          .then(([sales, products, lowStock]) => {
            setSalesData(sales)
            setTopProducts(products?.top_products || [])
            setLowStockData(lowStock)
            setLoading(false)
          })
          .catch((err) => {
            console.error(err)
            setLoading(false)
          })
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  return (
    <div className="flex flex-col gap-y-4 p-6">
      <Heading level="h1">Analytics & Reports Overview</Heading>

      {/* Sales Metrics Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Container className="p-4">
          <Text className="text-ui-fg-subtle">Total Revenue</Text>
          <Heading level="h2" className="mt-2">
            {loading ? "Loading..." : `$${salesData?.metrics?.revenue || 0}`}
          </Heading>
        </Container>
        <Container className="p-4">
          <Text className="text-ui-fg-subtle">Total Orders Count</Text>
          <Heading level="h2" className="mt-2">
            {loading ? "Loading..." : salesData?.metrics?.orders_count || 0}
          </Heading>
        </Container>
      </div>

      {/* Top Products Table */}
      <Container className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b">
          <Heading level="h2">Top Selling Products</Heading>
        </div>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Product Title</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Total Sold</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell>Loading products...</Table.Cell>
              </Table.Row>
            ) : topProducts.length === 0 ? (
              <Table.Row>
                <Table.Cell>No sales data available yet.</Table.Cell>
              </Table.Row>
            ) : (
              topProducts.map((prod, index) => (
                <Table.Row key={index}>
                  <Table.Cell>{prod.title}</Table.Cell>
                  <Table.Cell className="text-right">{prod.qty}</Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </Container>

      {/* Low Stock Alerts */}
      <Container className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <Heading level="h2">Low Stock Inventory Alerts</Heading>
          <span className="text-sm text-ui-fg-subtle">
            Threshold: ≤ {lowStockData?.threshold || 5}
          </span>
        </div>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Inventory Item ID</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Stocked Quantity</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell>Loading stock data...</Table.Cell>
              </Table.Row>
            ) : !lowStockData?.items || lowStockData.items.length === 0 ? (
              <Table.Row>
                <Table.Cell>No low stock items found.</Table.Cell>
              </Table.Row>
            ) : (
              lowStockData.items.map((item: any, index: number) => (
                <Table.Row key={index}>
                  <Table.Cell>{item.inventory_item_id}</Table.Cell>
                  <Table.Cell className="text-right text-rose-600 font-semibold">
                    {item.stocked_quantity}
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Analytics",
  icon: ChatBubbleLeftRight,
})

export default AnalyticsPage