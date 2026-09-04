import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ShoppingBag } from "@medusajs/icons"
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

type PurchaseOrder = {
  id: string
  po_number: string
  status: string
  supplier_id: string
  total: number
  currency_code: string
  created_at: string
}

type Supplier = { id: string; name: string }

const statusColor: Record<string, "grey" | "orange" | "blue" | "green" | "red"> =
  {
    draft: "grey",
    submitted: "blue",
    partially_received: "orange",
    received: "green",
    canceled: "red",
  }

const statusOptions = [
  "draft",
  "submitted",
  "partially_received",
  "received",
  "canceled",
]

const PAGE_SIZE = 20

const PurchaseOrdersPage = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState("all")
  const [supplierFilter, setSupplierFilter] = useState("all")
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetch("/admin/suppliers?limit=100", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setSuppliers(data.suppliers || []))
      .catch(() => undefined)
  }, [])

  // Any filter change puts us back on the first page.
  useEffect(() => {
    setOffset(0)
  }, [statusFilter, supplierFilter, search])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true)

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (supplierFilter !== "all") params.set("supplier_id", supplierFilter)
      if (search) params.set("q", search)

      fetch(`/admin/purchase-orders?${params.toString()}`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          setPurchaseOrders(data.purchase_orders || [])
          setCount(data.count || 0)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }, 300)

    return () => clearTimeout(timeout)
  }, [statusFilter, supplierFilter, search, offset])

  const supplierName = (id: string) =>
    suppliers.find((supplier) => supplier.id === id)?.name || id

  const from = count === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, count)

  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Purchase Orders</Heading>
        <Button
          size="small"
          onClick={() => (window.location.href = "/app/purchase-orders/create")}
        >
          Create
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 px-6 pb-4">
        <div className="w-48">
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

        <div className="w-56">
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <Select.Trigger>
              <Select.Value placeholder="All suppliers" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All suppliers</Select.Item>
              {suppliers.map((supplier) => (
                <Select.Item key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>

        <div className="w-64">
          <Input
            placeholder="Search PO number..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Text className="px-6 pb-6">Loading...</Text>
      ) : purchaseOrders.length === 0 ? (
        <Text className="px-6 pb-6">No purchase orders found.</Text>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>PO Number</Table.HeaderCell>
                <Table.HeaderCell>Supplier</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Total</Table.HeaderCell>
                <Table.HeaderCell>Created</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {purchaseOrders.map((po) => (
                <Table.Row
                  key={po.id}
                  className="cursor-pointer"
                  onClick={() => {
                    window.location.href = `/app/purchase-orders/${po.id}`
                  }}
                >
                  <Table.Cell>{po.po_number}</Table.Cell>
                  <Table.Cell>{supplierName(po.supplier_id)}</Table.Cell>
                  <Table.Cell>
                    <Badge color={statusColor[po.status] || "grey"}>
                      {po.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {po.total} {po.currency_code?.toUpperCase()}
                  </Table.Cell>
                  <Table.Cell>
                    {new Date(po.created_at).toLocaleDateString()}
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
  label: "Purchase Orders",
  icon: ShoppingBag,
})

export default PurchaseOrdersPage
