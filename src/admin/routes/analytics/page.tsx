import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text } from "@medusajs/ui"
import { ChatBubbleLeftRight } from "@medusajs/icons" // Aap koi bhi icon import kar sakte hain
import { useEffect, useState } from "react"

const AnalyticsPage = () => {
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
        <Heading level="h1">Analytics & Reports</Heading>
      </div>
      <div className="grid grid-cols-2 gap-4 px-6 py-6">
        <div className="border p-4 rounded-rounded bg-subtle">
          <Text className="text-ui-fg-subtle">Total Revenue</Text>
          <Heading level="h2" className="mt-2">
            {loading ? "Loading..." : `$${salesData?.metrics?.revenue || 0}`}
          </Heading>
        </div>
        <div className="border p-4 rounded-rounded bg-subtle">
          <Text className="text-ui-fg-subtle">Total Orders Count</Text>
          <Heading level="h2" className="mt-2">
            {loading ? "Loading..." : salesData?.metrics?.orders_count || 0}
          </Heading>
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Analytics",
  icon: ChatBubbleLeftRight, // Yahan aap koi bhi dashboard icon laga sakte hain
})

export default AnalyticsPage