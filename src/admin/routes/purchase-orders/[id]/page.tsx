import { Container, Heading, Badge, Text, Button, Table, Drawer, Input, Label } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"

type LineItem = {
  id: string
  title: string
  sku: string
  quantity_ordered: number
  quantity_received: number
  unit_cost: number
  line_total: number
}

type PurchaseOrder = {
  id: string
  po_number: string
  status: string
  supplier_id: string
  stock_location_id: string
  currency_code: string
  subtotal: number
  tax_total: number
  shipping_total: number
  total: number
  notes: string | null
  items: LineItem[]
}

const statusColor: Record<string, "grey" | "orange" | "blue" | "green" | "red"> = {
  draft: "grey",
  submitted: "blue",
  partially_received: "orange",
  received: "green",
  canceled: "red",
}

const PurchaseOrderDetailPage = () => {
  const { id } = useParams()
  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({})
  const [receiveError, setReceiveError] = useState("")

  const fetchPo = () => {
    fetch(`/admin/purchase-orders/${id}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setPo(data.purchase_order)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchPo()
  }, [id])

  const handleSubmit = async () => {
    setActionLoading(true)
    const res = await fetch(`/admin/purchase-orders/${id}/submit`, {
      method: "POST",
      credentials: "include",
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.message || "Could not submit this purchase order.")
    }
    fetchPo()
    setActionLoading(false)
  }

  const handleCancel = async () => {
    setActionLoading(true)
    const res = await fetch(`/admin/purchase-orders/${id}/cancel`, {
      method: "POST",
      credentials: "include",
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.message || "Cannot cancel this PO.")
    }
    fetchPo()
    setActionLoading(false)
  }

  const openReceiveDrawer = () => {
    if (!po) return
    const initial: Record<string, string> = {}
    po.items.forEach((item) => {
      const outstanding = item.quantity_ordered - item.quantity_received
      if (outstanding > 0) {
        initial[item.id] = String(outstanding)
      }
    })
    setReceiveQtys(initial)
    setReceiveError("")
    setDrawerOpen(true)
  }

  const handleReceiveSubmit = async () => {
    if (!po) return
    setReceiveError("")

    const lines = Object.entries(receiveQtys)
      .map(([line_item_id, qty]) => ({
        line_item_id,
        quantity_received: Number(qty) || 0,
      }))
      .filter((l) => l.quantity_received > 0)

    if (lines.length === 0) {
      setReceiveError("Enter at least one quantity to receive.")
      return
    }

    // client-side validation against outstanding
    for (const line of lines) {
      const item = po.items.find((i) => i.id === line.line_item_id)
      if (!item) continue
      const outstanding = item.quantity_ordered - item.quantity_received
      if (line.quantity_received > outstanding) {
        setReceiveError(
          `"${item.title}" — cannot receive ${line.quantity_received}, only ${outstanding} outstanding.`
        )
        return
      }
    }

    setActionLoading(true)
    const res = await fetch(`/admin/purchase-orders/${id}/receive`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setReceiveError(err.message || "Failed to receive stock.")
      setActionLoading(false)
      return
    }

    setActionLoading(false)
    setDrawerOpen(false)
    fetchPo()
  }

  if (loading) return <Container><Text className="p-6">Loading...</Text></Container>
  if (!po) return <Container><Text className="p-6">Purchase order not found.</Text></Container>

  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">{po.po_number}</Heading>
          <Badge color={statusColor[po.status] || "grey"} className="mt-2">
            {po.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          {po.status === "draft" && (
            <Button size="small" onClick={handleSubmit} isLoading={actionLoading}>
              Submit
            </Button>
          )}
          {(po.status === "submitted" || po.status === "partially_received") && (
            <Button size="small" onClick={openReceiveDrawer}>
              Receive Stock
            </Button>
          )}
          {po.status !== "canceled" && po.status !== "received" && (
            <Button
              size="small"
              variant="danger"
              onClick={handleCancel}
              isLoading={actionLoading}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="px-6 pb-4 flex gap-8">
        <div>
          <Text size="small" className="text-ui-fg-subtle">Supplier ID</Text>
          <Text>{po.supplier_id}</Text>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">Location ID</Text>
          <Text>{po.stock_location_id}</Text>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">Total</Text>
          <Text>{po.total} {po.currency_code?.toUpperCase()}</Text>
        </div>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Item</Table.HeaderCell>
            <Table.HeaderCell>SKU</Table.HeaderCell>
            <Table.HeaderCell>Ordered</Table.HeaderCell>
            <Table.HeaderCell>Received</Table.HeaderCell>
            <Table.HeaderCell>Unit Cost</Table.HeaderCell>
            <Table.HeaderCell>Line Total</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {po.items?.map((item) => (
            <Table.Row key={item.id}>
              <Table.Cell>{item.title}</Table.Cell>
              <Table.Cell>{item.sku}</Table.Cell>
              <Table.Cell>{item.quantity_ordered}</Table.Cell>
              <Table.Cell>{item.quantity_received}</Table.Cell>
              <Table.Cell>{item.unit_cost}</Table.Cell>
              <Table.Cell>{item.line_total}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Receive Stock — {po.po_number}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4">
            {receiveError && (
              <Text className="text-ui-fg-error">{receiveError}</Text>
            )}
            {po.items
              .filter((item) => item.quantity_received < item.quantity_ordered)
              .map((item) => {
                const outstanding = item.quantity_ordered - item.quantity_received
                return (
                  <div key={item.id}>
                    <Label size="small">
                      {item.title} ({item.sku}) — outstanding: {outstanding}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={outstanding}
                      value={receiveQtys[item.id] ?? ""}
                      onChange={(e) =>
                        setReceiveQtys((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                )
              })}
            {po.items.every((item) => item.quantity_received >= item.quantity_ordered) && (
              <Text>All items already fully received.</Text>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReceiveSubmit} isLoading={actionLoading}>
              Confirm Receive
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export default PurchaseOrderDetailPage