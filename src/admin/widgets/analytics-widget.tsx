import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

const AnalyticsWidget = () => {
  const [salesData, setSalesData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/admin/analytics/sales", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        setSalesData(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Store Analytics Overview</Heading>
      </div>
      <div className="grid grid-cols-2 gap-4 px-6 py-4">
        <div className="border p-4 rounded-rounded">
          <Text className="text-ui-fg-subtle">Total Revenue</Text>
          <Heading level="h3">
            {loading ? "Loading..." : `$${salesData?.metrics?.revenue || 0}`}
          </Heading>
        </div>
        <div className="border p-4 rounded-rounded">
          <Text className="text-ui-fg-subtle">Total Orders</Text>
          <Heading level="h3">
            {loading ? "Loading..." : salesData?.metrics?.orders_count || 0}
          </Heading>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.list.before", // Change this to a valid InjectionZoneRegistry key
})

export default AnalyticsWidget