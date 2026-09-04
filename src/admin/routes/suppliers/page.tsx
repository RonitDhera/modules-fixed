import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Buildings, PencilSquare } from "@medusajs/icons"
import {
  Button,
  Container,
  Heading,
  IconButton,
  Input,
  Label,
  Table,
  Text,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

type Supplier = {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  currency_code: string
  notes: string | null
}

type SupplierForm = {
  name: string
  email: string
  phone: string
  address: string
  currency_code: string
  notes: string
}

const emptyForm = (): SupplierForm => ({
  name: "",
  email: "",
  phone: "",
  address: "",
  currency_code: "usd",
  notes: "",
})

const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  /** null while creating, the supplier id while editing. */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SupplierForm>(emptyForm())

  const fetchSuppliers = () => {
    setLoading(true)
    fetch("/admin/suppliers?limit=100", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setSuppliers(data.suppliers || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const setField = (field: keyof SupplierForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const startCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setError("")
    setFormOpen(true)
  }

  const startEdit = (supplier: Supplier) => {
    setEditingId(supplier.id)
    setForm({
      name: supplier.name,
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
      currency_code: supplier.currency_code,
      notes: supplier.notes ?? "",
    })
    setError("")
    setFormOpen(true)
  }

  const handleSave = async () => {
    setError("")

    if (!form.name.trim()) {
      return setError("Name is required.")
    }
    if (form.currency_code.trim().length !== 3) {
      return setError("Currency must be a 3-letter code, for example usd.")
    }

    setSubmitting(true)

    const url = editingId ? `/admin/suppliers/${editingId}` : "/admin/suppliers"

    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        currency_code: form.currency_code.trim().toLowerCase(),
        notes: form.notes || null,
      }),
    })

    setSubmitting(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.message || "Could not save the supplier.")
      return
    }

    setFormOpen(false)
    setEditingId(null)
    setForm(emptyForm())
    fetchSuppliers()
  }

  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Suppliers</Heading>
        <Button
          size="small"
          onClick={() => (formOpen ? setFormOpen(false) : startCreate())}
        >
          {formOpen ? "Close" : "New supplier"}
        </Button>
      </div>

      {formOpen && (
        <div className="px-6 pb-6 border-b">
          <Text className="mb-3">
            {editingId ? "Edit supplier" : "New supplier"}
          </Text>

          {error && <Text className="text-ui-fg-error mb-2">{error}</Text>}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label size="xsmall">Name</Label>
              <Input
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
              />
            </div>
            <div>
              <Label size="xsmall">Email</Label>
              <Input
                value={form.email}
                onChange={(event) => setField("email", event.target.value)}
              />
            </div>
            <div>
              <Label size="xsmall">Phone</Label>
              <Input
                value={form.phone}
                onChange={(event) => setField("phone", event.target.value)}
              />
            </div>
            <div>
              <Label size="xsmall">Currency code</Label>
              <Input
                value={form.currency_code}
                onChange={(event) =>
                  setField("currency_code", event.target.value)
                }
              />
            </div>
            <div>
              <Label size="xsmall">Address</Label>
              <Input
                value={form.address}
                onChange={(event) => setField("address", event.target.value)}
              />
            </div>
            <div>
              <Label size="xsmall">Notes</Label>
              <Input
                value={form.notes}
                onChange={(event) => setField("notes", event.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="small" onClick={handleSave} isLoading={submitting}>
              {editingId ? "Save changes" : "Create supplier"}
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <Text className="px-6 py-6">Loading...</Text>
      ) : suppliers.length === 0 ? (
        <Text className="px-6 py-6">No suppliers yet.</Text>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell>Email</Table.HeaderCell>
                <Table.HeaderCell>Phone</Table.HeaderCell>
                <Table.HeaderCell>Currency</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {suppliers.map((supplier) => (
                <Table.Row key={supplier.id}>
                  <Table.Cell>{supplier.name}</Table.Cell>
                  <Table.Cell>{supplier.email || "—"}</Table.Cell>
                  <Table.Cell>{supplier.phone || "—"}</Table.Cell>
                  <Table.Cell>
                    {supplier.currency_code?.toUpperCase()}
                  </Table.Cell>
                  <Table.Cell>
                    <IconButton
                      variant="transparent"
                      onClick={() => startEdit(supplier)}
                    >
                      <PencilSquare />
                    </IconButton>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Suppliers",
  icon: Buildings,
})

export default SuppliersPage
