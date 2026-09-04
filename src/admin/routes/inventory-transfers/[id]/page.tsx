import { Container, Heading, Badge, Text, Button, Table, Drawer, Input, Label } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"

type LineItem = {
  id: string
  title: string
  sku: string
  quantity_requested: number
  quantity_shipped: number
  quantity_received: number
}

type Transfer = {
  id: string
  transfer_number: string
  status: string
  from_location_id: string
  to_location_id: string
  notes: string | null
  shipped_at: string | null
  received_at: string | null
  items: LineItem[]
}

type StockLocation = {
  id: string
  name: string
}

const statusColor: Record<string, "grey" | "orange" | "blue" | "green" | "red"> = {
  draft: "grey",
  requested: "blue",
  in_transit: "orange",
  received: "green",
  canceled: "red",
}

const TransferDetailPage = () => {
  const { id } = useParams()
  const [transfer, setTransfer] = useState<Transfer | null>(null)
  const [locations, setLocations] = useState<StockLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const [shipDrawerOpen, setShipDrawerOpen] = useState(false)
  const [receiveDrawerOpen, setReceiveDrawerOpen] = useState(false)
  const [qtys, setQtys] = useState<Record<string, string>>({})
  const [drawerError, setDrawerError] = useState("")

  const fetchTransfer = () => {
    fetch(`/admin/inventory-transfers/${id}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setTransfer(data.transfer)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchTransfer()
  }, [id])

  useEffect(() => {
    fetch("/admin/stock-locations", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setLocations(data.stock_locations || []))
  }, [])

  const locationName = (locationId: string) =>
    locations.find((l) => l.id === locationId)?.name || locationId

  const handleCancel = async () => {
    setActionLoading(true)
    const res = await fetch(`/admin/inventory-transfers/${id}/cancel`, {
      method: "POST",
      credentials: "include",
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.message || "Cannot cancel this transfer.")
    }
    fetchTransfer()
    setActionLoading(false)
  }

  // draft -> requested, the step that used to be unreachable
  const handleRequest = async () => {
    setActionLoading(true)
    const res = await fetch(`/admin/inventory-transfers/${id}/request`, {
      method: "POST",
      credentials: "include",
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.message || "Could not submit this transfer.")
    }
    fetchTransfer()
    setActionLoading(false)
  }

  const openShipDrawer = () => {
    if (!transfer) return
    const initial: Record<string, string> = {}
    transfer.items.forEach((item) => {
      const outstanding = item.quantity_requested - item.quantity_shipped
      if (outstanding > 0) initial[item.id] = String(outstanding)
    })
    setQtys(initial)
    setDrawerError("")
    setShipDrawerOpen(true)
  }

  const openReceiveDrawer = () => {
    if (!transfer) return
    const initial: Record<string, string> = {}
    transfer.items.forEach((item) => {
      const outstanding = item.quantity_shipped - item.quantity_received
      if (outstanding > 0) initial[item.id] = String(outstanding)
    })
    setQtys(initial)
    setDrawerError("")
    setReceiveDrawerOpen(true)
  }

  const handleShipSubmit = async () => {
    if (!transfer) return
    setDrawerError("")

    const lines = Object.entries(qtys)
      .map(([line_item_id, qty]) => ({
        line_item_id,
        quantity_shipped: Number(qty) || 0,
      }))
      .filter((l) => l.quantity_shipped > 0)

    if (lines.length === 0) {
      setDrawerError("Enter at least one quantity to ship.")
      return
    }

    setActionLoading(true)
    const res = await fetch(`/admin/inventory-transfers/${id}/ship`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setDrawerError(err.message || "Failed to ship transfer.")
      setActionLoading(false)
      return
    }

    setActionLoading(false)
    setShipDrawerOpen(false)
    fetchTransfer()
  }

  const handleReceiveSubmit = async () => {
    if (!transfer) return
    setDrawerError("")

    const lines = Object.entries(qtys)
      .map(([line_item_id, qty]) => ({
        line_item_id,
        quantity_received: Number(qty) || 0,
      }))
      .filter((l) => l.quantity_received > 0)

    if (lines.length === 0) {
      setDrawerError("Enter at least one quantity to receive.")
      return
    }

    setActionLoading(true)
    const res = await fetch(`/admin/inventory-transfers/${id}/receive`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setDrawerError(err.message || "Failed to receive transfer.")
      setActionLoading(false)
      return
    }

    setActionLoading(false)
    setReceiveDrawerOpen(false)
    fetchTransfer()
  }

  if (loading) return <Container><Text className="p-6">Loading...</Text></Container>
  if (!transfer) return <Container><Text className="p-6">Transfer not found.</Text></Container>

  // A partial shipment leaves lines outstanding; the rest can still go out.
  const hasUnshipped = transfer.items.some(
    (item) => item.quantity_shipped < item.quantity_requested
  )

  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">{transfer.transfer_number}</Heading>
          <Badge color={statusColor[transfer.status] || "grey"} className="mt-2">
            {transfer.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          {transfer.status === "draft" && (
            <Button
              size="small"
              variant="secondary"
              onClick={handleRequest}
              isLoading={actionLoading}
            >
              Submit request
            </Button>
          )}
          {(transfer.status === "draft" ||
            transfer.status === "requested" ||
            (transfer.status === "in_transit" && hasUnshipped)) && (
            <Button size="small" onClick={openShipDrawer}>
              {transfer.status === "in_transit" ? "Ship remaining" : "Ship"}
            </Button>
          )}
          {transfer.status === "in_transit" && (
            <Button size="small" onClick={openReceiveDrawer}>
              Receive
            </Button>
          )}
          {transfer.status !== "received" && transfer.status !== "canceled" && (
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
          <Text size="small" className="text-ui-fg-subtle">From Location</Text>
          <Text>{locationName(transfer.from_location_id)}</Text>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">To Location</Text>
          <Text>{locationName(transfer.to_location_id)}</Text>
        </div>
        {transfer.shipped_at && (
          <div>
            <Text size="small" className="text-ui-fg-subtle">Shipped At</Text>
            <Text>{new Date(transfer.shipped_at).toLocaleString()}</Text>
          </div>
        )}
        {transfer.received_at && (
          <div>
            <Text size="small" className="text-ui-fg-subtle">Received At</Text>
            <Text>{new Date(transfer.received_at).toLocaleString()}</Text>
          </div>
        )}
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Item</Table.HeaderCell>
            <Table.HeaderCell>SKU</Table.HeaderCell>
            <Table.HeaderCell>Requested</Table.HeaderCell>
            <Table.HeaderCell>Shipped</Table.HeaderCell>
            <Table.HeaderCell>Received</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {transfer.items?.map((item) => (
            <Table.Row key={item.id}>
              <Table.Cell>{item.title}</Table.Cell>
              <Table.Cell>{item.sku}</Table.Cell>
              <Table.Cell>{item.quantity_requested}</Table.Cell>
              <Table.Cell>{item.quantity_shipped}</Table.Cell>
              <Table.Cell>{item.quantity_received}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      {/* Ship Drawer */}
      <Drawer open={shipDrawerOpen} onOpenChange={setShipDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Ship — {transfer.transfer_number}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4">
            {drawerError && <Text className="text-ui-fg-error">{drawerError}</Text>}
            {transfer.items
              .filter((item) => item.quantity_shipped < item.quantity_requested)
              .map((item) => {
                const outstanding = item.quantity_requested - item.quantity_shipped
                return (
                  <div key={item.id}>
                    <Label size="small">
                      {item.title} ({item.sku}) — outstanding: {outstanding}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={outstanding}
                      value={qtys[item.id] ?? ""}
                      onChange={(e) =>
                        setQtys((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                    />
                  </div>
                )
              })}
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="secondary" onClick={() => setShipDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleShipSubmit} isLoading={actionLoading}>
              Confirm Ship
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      {/* Receive Drawer */}
      <Drawer open={receiveDrawerOpen} onOpenChange={setReceiveDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Receive — {transfer.transfer_number}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4">
            {drawerError && <Text className="text-ui-fg-error">{drawerError}</Text>}
            {transfer.items
              .filter((item) => item.quantity_received < item.quantity_shipped)
              .map((item) => {
                const outstanding = item.quantity_shipped - item.quantity_received
                return (
                  <div key={item.id}>
                    <Label size="small">
                      {item.title} ({item.sku}) — outstanding: {outstanding}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={outstanding}
                      value={qtys[item.id] ?? ""}
                      onChange={(e) =>
                        setQtys((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                    />
                  </div>
                )
              })}
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="secondary" onClick={() => setReceiveDrawerOpen(false)}>
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

export default TransferDetailPage