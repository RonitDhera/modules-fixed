import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowPath } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Select,
  Table,
  Text,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

type Transfer = {
  id: string
  transfer_number: string
  status: string
  from_location_id: string
  to_location_id: string
  created_at: string
}

type StockLocation = { id: string; name: string }

const statusColor: Record<string, "grey" | "orange" | "blue" | "green" | "red"> =
  {
    draft: "grey",
    requested: "blue",
    in_transit: "orange",
    received: "green",
    canceled: "red",
  }

const statusOptions = [
  "draft",
  "requested",
  "in_transit",
  "received",
  "canceled",
]

const PAGE_SIZE = 20

const InventoryTransfersPage = () => {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [locations, setLocations] = useState<StockLocation[]>([])
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState("all")
  const [fromFilter, setFromFilter] = useState("all")
  const [toFilter, setToFilter] = useState("all")
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetch("/admin/stock-locations", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setLocations(data.stock_locations || []))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    setOffset(0)
  }, [statusFilter, fromFilter, toFilter, search])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true)

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (fromFilter !== "all") params.set("from_location_id", fromFilter)
      if (toFilter !== "all") params.set("to_location_id", toFilter)
      if (search) params.set("q", search)

      fetch(`/admin/inventory-transfers?${params.toString()}`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          setTransfers(data.transfers || [])
          setCount(data.count || 0)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }, 300)

    return () => clearTimeout(timeout)
  }, [statusFilter, fromFilter, toFilter, search, offset])

  const locationName = (id: string) =>
    locations.find((location) => location.id === id)?.name || id

  const from = count === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, count)

  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Inventory Transfers</Heading>
        <Button
          size="small"
          onClick={() =>
            (window.location.href = "/inventory-transfers/create")
          }
        >
          Create
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 px-6 pb-4">
        <div className="w-44">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <Select.Trigger>
              <Select.Value placeholder="All statuses" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All statuses</Select.Item>
              {statusOptions.map((status) => (
                <Select.Item key={status} value={status}>
                  {status}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>

        <div className="w-48">
          <Select value={fromFilter} onValueChange={setFromFilter}>
            <Select.Trigger>
              <Select.Value placeholder="Any source" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">Any source</Select.Item>
              {locations.map((location) => (
                <Select.Item key={location.id} value={location.id}>
                  {location.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>

        <div className="w-48">
          <Select value={toFilter} onValueChange={setToFilter}>
            <Select.Trigger>
              <Select.Value placeholder="Any destination" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">Any destination</Select.Item>
              {locations.map((location) => (
                <Select.Item key={location.id} value={location.id}>
                  {location.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>

        <div className="w-56">
          <Input
            placeholder="Search transfer number..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Text className="px-6 pb-6">Loading...</Text>
      ) : transfers.length === 0 ? (
        <Text className="px-6 pb-6">No transfers found.</Text>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Transfer #</Table.HeaderCell>
                <Table.HeaderCell>From</Table.HeaderCell>
                <Table.HeaderCell>To</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Created</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {transfers.map((transfer) => (
                <Table.Row
                  key={transfer.id}
                  className="cursor-pointer"
                  onClick={() => {
                    window.location.href = `/inventory-transfers/${transfer.id}`
                  }}
                >
                  <Table.Cell>{transfer.transfer_number}</Table.Cell>
                  <Table.Cell>
                    {locationName(transfer.from_location_id)}
                  </Table.Cell>
                  <Table.Cell>
                    {locationName(transfer.to_location_id)}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={statusColor[transfer.status] || "grey"}>
                      {transfer.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {new Date(transfer.created_at).toLocaleDateString()}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between px-6 py-4 border-t">
        <Text size="small" className="text-ui-fg-subtle">
          {from}–{to} of {count}
        </Text>
        <div className="flex gap-2">
          <Button
            size="small"
            variant="secondary"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Previous
          </Button>
          <Button
            size="small"
            variant="secondary"
            disabled={offset + PAGE_SIZE >= count}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Inventory Transfers",
  icon: ArrowPath,
})

export default InventoryTransfersPage
