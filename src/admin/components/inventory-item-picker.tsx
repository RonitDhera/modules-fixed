import { Button, Input, Label, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

export type InventoryItemOption = {
  id: string
  sku: string | null
  title: string | null
}

type Props = {
  label?: string
  /** Items already on the document, so they can't be added twice. */
  excludeIds?: string[]
  onSelect: (item: InventoryItemOption) => void
}

/**
 * Searches Medusa's native inventory items and hands the chosen one back.
 *
 * Both modules move stock through the Inventory module, which needs a real
 * `inventory_item_id` on every line — typing a free-text title is not enough,
 * because there is then nothing to adjust stock against.
 */
export const InventoryItemPicker = ({
  label = "Add item",
  excludeIds = [],
  onSelect,
}: Props) => {
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<InventoryItemOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true)
      setError("")

      const params = new URLSearchParams({ limit: "20" })
      if (search) {
        params.set("q", search)
      }

      fetch(`/admin/inventory-items?${params.toString()}`, {
        credentials: "include",
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error("Could not load inventory items.")
          }
          return res.json()
        })
        .then((data) => {
          setResults(data.inventory_items ?? [])
          setLoading(false)
        })
        .catch(() => {
          setError("Could not load inventory items.")
          setLoading(false)
        })
    }, 300)

    return () => clearTimeout(timeout)
  }, [search])

  const excluded = new Set(excludeIds)
  const visible = results.filter((item) => !excluded.has(item.id))

  return (
    <div className="flex flex-col gap-2">
      <Label size="xsmall">{label}</Label>

      <Input
        placeholder="Search by SKU or title..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {error && <Text className="text-ui-fg-error">{error}</Text>}

      <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
        {loading && (
          <Text size="small" className="px-3 py-2 text-ui-fg-subtle">
            Loading...
          </Text>
        )}

        {!loading && visible.length === 0 && (
          <Text size="small" className="px-3 py-2 text-ui-fg-subtle">
            {results.length
              ? "Every matching item is already on this document."
              : "No inventory items found. Create one under Products first."}
          </Text>
        )}

        {!loading &&
          visible.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <Text size="small" className="truncate">
                  {item.title || item.sku || item.id}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle truncate">
                  {item.sku ? `SKU ${item.sku}` : "No SKU"}
                </Text>
              </div>
              <Button
                size="small"
                variant="secondary"
                type="button"
                onClick={() => onSelect(item)}
              >
                Add
              </Button>
            </div>
          ))}
      </div>
    </div>
  )
}

export default InventoryItemPicker
