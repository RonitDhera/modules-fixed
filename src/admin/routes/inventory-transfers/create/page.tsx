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

type StockLocation = { id: string; name: string }

type LineItemForm = {
  inventory_item_id: string
  title: string
  sku: string | null
  quantity_requested: string
}

const CreateInventoryTransferPage = () => {
  const [locations, setLocations] = useState<StockLocation[]>([])
  const [fromLocationId, setFromLocationId] = useState("")
  const [toLocationId, setToLocationId] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<LineItemForm[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/admin/stock-locations", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setLocations(data.stock_locations || []))
      .catch(() => setError("Could not load stock locations."))
  }, [])

  const addItem = (item: InventoryItemOption) =>
    setItems((prev) => [
      ...prev,
      {
        inventory_item_id: item.id,
        title: item.title || item.sku || item.id,
        sku: item.sku,
        quantity_requested: "1",
      },
    ])

  const updateQuantity = (index: number, value: string) =>
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity_requested: value } : item
      )
    )

  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index))

  const handleSubmit = async () => {
    setError("")

    if (!fromLocationId) return setError("Select a source location.")
    if (!toLocationId) return setError("Select a destination location.")
    if (fromLocationId === toLocationId) {
      return setError("Source and destination must be different.")
    }
    if (!items.length) return setError("Add at least one item.")

    const invalid = items.find((item) => !(Number(item.quantity_requested) > 0))
    if (invalid) {
      return setError(`"${invalid.title}" needs a quantity of at least 1.`)
    }

    setSubmitting(true)

    const res = await fetch("/admin/inventory-transfers", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_location_id: fromLocationId,
        to_location_id: toLocationId,
        notes: notes || null,
        items: items.map((item) => ({
          inventory_item_id: item.inventory_item_id,
          title: item.title,
          sku: item.sku,
          quantity_requested: Number(item.quantity_requested),
        })),
      }),
    })

    setSubmitting(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.message || "Could not create the transfer.")
      return
    }

    const data = await res.json()

    // The API warns when the source does not currently hold enough stock.
    const warnings = data.transfer?.availability_warnings ?? []
    if (warnings.length) {
      const summary = warnings
        .map(
          (warning: { title: string; requested: number; available: number }) =>
            `${warning.title}: ${warning.available} available, ${warning.requested} requested`
        )
        .join("\n")

      window.alert(
        `Transfer created, but the source location is short on:\n\n${summary}\n\nYou can still ship what is available.`
      )
    }

    window.location.href = `/inventory-transfers/${data.transfer.id}`
  }

  const destinationOptions = locations.filter(
    (location) => location.id !== fromLocationId
  )

  return (
    <Container className="p-6 max-w-4xl">
      <Heading level="h1" className="mb-6">
        New Inventory Transfer
      </Heading>

      {error && <Text className="text-ui-fg-error mb-4">{error}</Text>}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <Label size="xsmall">From</Label>
          <Select value={fromLocationId} onValueChange={setFromLocationId}>
            <Select.Trigger>
              <Select.Value placeholder="Source location" />
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
          <Label size="xsmall">To</Label>
          <Select value={toLocationId} onValueChange={setToLocationId}>
            <Select.Trigger>
              <Select.Value placeholder="Destination location" />
            </Select.Trigger>
            <Select.Content>
              {destinationOptions.map((location) => (
                <Select.Item key={location.id} value={location.id}>
                  {location.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>

        <div className="col-span-2">
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
                <Table.HeaderCell>Quantity requested</Table.HeaderCell>
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
                      value={item.quantity_requested}
                      onChange={(event) =>
                        updateQuantity(index, event.target.value)
                      }
                    />
                  </Table.Cell>
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

      <div className="flex justify-end border-t pt-4">
        <Button onClick={handleSubmit} isLoading={submitting}>
          Create transfer
        </Button>
      </div>
    </Container>
  )
}

export default CreateInventoryTransferPage
