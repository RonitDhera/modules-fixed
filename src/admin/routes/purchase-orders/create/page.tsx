import { Trash } from "@medusajs/icons"
import {
  Button,
  Container,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  Table,
  Text,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

import {
  InventoryItemOption,
  InventoryItemPicker,
} from "../../../components/inventory-item-picker"

type Supplier = { id: string; name: string; currency_code: string }
type StockLocation = { id: string; name: string }

type LineItemForm = {
  inventory_item_id: string
  title: string
  sku: string | null
  quantity_ordered: string
  unit_cost: string
}

const CreatePurchaseOrderPage = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [locations, setLocations] = useState<StockLocation[]>([])
  const [supplierId, setSupplierId] = useState("")
  const [locationId, setLocationId] = useState("")
  const [currencyCode, setCurrencyCode] = useState("usd")
  const [notes, setNotes] = useState("")
  const [taxTotal, setTaxTotal] = useState("0")
  const [shippingTotal, setShippingTotal] = useState("0")
  const [items, setItems] = useState<LineItemForm[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/admin/suppliers?limit=100", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setSuppliers(data.suppliers || []))
      .catch(() => setError("Could not load suppliers."))

    fetch("/admin/stock-locations", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setLocations(data.stock_locations || []))
      .catch(() => setError("Could not load stock locations."))
  }, [])

  // Default the currency to whatever the chosen supplier bills in.
  useEffect(() => {
    const supplier = suppliers.find((s) => s.id === supplierId)
    if (supplier?.currency_code) {
      setCurrencyCode(supplier.currency_code)
    }
  }, [supplierId, suppliers])

  const addItem = (item: InventoryItemOption) =>
    setItems((prev) => [
      ...prev,
      {
        inventory_item_id: item.id,
        title: item.title || item.sku || item.id,
        sku: item.sku,
        quantity_ordered: "1",
        unit_cost: "0",
      },
    ])

  const updateItem = (
    index: number,
    field: "quantity_ordered" | "unit_cost",
    value: string
  ) =>
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )

  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index))

  const lineTotal = (item: LineItemForm) =>
    (Number(item.quantity_ordered) || 0) * (Number(item.unit_cost) || 0)

  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0)
  const total =
    subtotal + (Number(taxTotal) || 0) + (Number(shippingTotal) || 0)

  const handleSubmit = async () => {
    setError("")

    if (!supplierId) return setError("Select a supplier.")
    if (!locationId) return setError("Select a destination stock location.")
    if (!items.length) return setError("Add at least one item.")

    const invalid = items.find(
      (item) => !(Number(item.quantity_ordered) > 0)
    )
    if (invalid) {
      return setError(`"${invalid.title}" needs a quantity of at least 1.`)
    }

    setSubmitting(true)

    const res = await fetch("/admin/purchase-orders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier_id: supplierId,
        stock_location_id: locationId,
        currency_code: currencyCode,
        notes: notes || null,
        tax_total: Number(taxTotal) || 0,
        shipping_total: Number(shippingTotal) || 0,
        items: items.map((item) => ({
          inventory_item_id: item.inventory_item_id,
          title: item.title,
          sku: item.sku,
          quantity_ordered: Number(item.quantity_ordered),
          unit_cost: Number(item.unit_cost) || 0,
        })),
      }),
    })

    setSubmitting(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.message || "Could not create the purchase order.")
      return
    }

    const data = await res.json()
    window.location.href = `/app/purchase-orders/${data.purchase_order.id}`
  }

  return (
    <Container className="p-6 max-w-4xl">
      <Heading level="h1" className="mb-6">
        New Purchase Order
      </Heading>

      {error && <Text className="text-ui-fg-error mb-4">{error}</Text>}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <Label size="xsmall">Supplier</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <Select.Trigger>
              <Select.Value placeholder="Select a supplier" />
            </Select.Trigger>
            <Select.Content>
              {suppliers.map((supplier) => (
                <Select.Item key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>

        <div>
          <Label size="xsmall">Deliver to</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <Select.Trigger>
              <Select.Value placeholder="Select a stock location" />
            </Select.Trigger>
            <Select.Content>
              {locations.map((location) => (
                <Select.Item key={location.id} value={location.id}>
                  {location.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>

        <div>
          <Label size="xsmall">Currency</Label>
          <Input
            value={currencyCode}
            onChange={(event) => setCurrencyCode(event.target.value)}
          />
        </div>

        <div>
          <Label size="xsmall">Notes</Label>
          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>

      <div className="mb-6">
        <InventoryItemPicker
          label="Add items"
          excludeIds={items.map((item) => item.inventory_item_id)}
          onSelect={addItem}
        />
      </div>

      {items.length > 0 && (
        <div className="mb-6 overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Item</Table.HeaderCell>
                <Table.HeaderCell>SKU</Table.HeaderCell>
                <Table.HeaderCell>Quantity</Table.HeaderCell>
                <Table.HeaderCell>Unit cost</Table.HeaderCell>
                <Table.HeaderCell>Line total</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {items.map((item, index) => (
                <Table.Row key={item.inventory_item_id}>
                  <Table.Cell>{item.title}</Table.Cell>
                  <Table.Cell>{item.sku || "—"}</Table.Cell>
                  <Table.Cell>
                    <Input
                      type="number"
                      min={1}
                      className="w-24"
                      value={item.quantity_ordered}
                      onChange={(event) =>
                        updateItem(index, "quantity_ordered", event.target.value)
                      }
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-28"
                      value={item.unit_cost}
                      onChange={(event) =>
                        updateItem(index, "unit_cost", event.target.value)
                      }
                    />
                  </Table.Cell>
                  <Table.Cell>{lineTotal(item).toFixed(2)}</Table.Cell>
                  <Table.Cell>
                    <IconButton
                      type="button"
                      variant="transparent"
                      onClick={() => removeItem(index)}
                    >
                      <Trash />
                    </IconButton>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
        <div>
          <Label size="xsmall">Tax</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={taxTotal}
            onChange={(event) => setTaxTotal(event.target.value)}
          />
        </div>
        <div>
          <Label size="xsmall">Shipping</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={shippingTotal}
            onChange={(event) => setShippingTotal(event.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <div>
          <Text size="small" className="text-ui-fg-subtle">
            Subtotal {subtotal.toFixed(2)} {currencyCode.toUpperCase()}
          </Text>
          <Text>
            Total {total.toFixed(2)} {currencyCode.toUpperCase()}
          </Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Totals are recalculated on the server when the PO is saved.
          </Text>
        </div>

        <Button onClick={handleSubmit} isLoading={submitting}>
          Create purchase order
        </Button>
      </div>
    </Container>
  )
}

export default CreatePurchaseOrderPage
