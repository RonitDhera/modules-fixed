# Alter Commerce — Inventory Operations Backend

Two custom Medusa v2 modules: supplier **Purchase Orders** and internal
**Inventory Transfers**. Every stock change goes through Medusa's native
Inventory module inside a workflow — neither module writes stock levels itself.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your environment file:

   ```bash
   cp .env.template .env
   ```

   Then fill in `DATABASE_URL`, `JWT_SECRET` and `COOKIE_SECRET`. The app
   refuses to boot without them — there are deliberately no fallback values, so
   a missing variable fails loudly instead of silently using someone's local
   database.

3. Run the migrations. They create `supplier`, `purchase_order`,
   `purchase_order_line_item`, `inventory_transfer` and
   `inventory_transfer_line_item`:

   ```bash
   npx medusa db:migrate
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:9000/app`. **Purchase Orders**, **Suppliers** and
   **Inventory Transfers** appear in the sidebar.

### Sample data

```bash
npx medusa exec ./src/scripts/seed-purchase-orders.ts
```

Seeds one supplier, one draft PO and one draft transfer, all created through
the same workflows the admin uses. It needs **at least one stock location and
one inventory item to already exist** — both modules move stock against real
inventory items, so it will tell you to create a product first rather than
seeding data that cannot ship or receive.

### Tests

```bash
npm run test:integration:http
```

Requires a reachable Postgres; the runner creates and drops its own test
database. Configuration comes from `.env.test`, which is committed and must
never hold real credentials.

> If Jest reports `0 matches`, that is a **path** problem, not a test problem —
> it matches on file paths. Check the project isn't inside a cloud-sync folder
> (OneDrive/Dropbox placeholder files and the 260-character Windows path limit
> both break discovery), and that no parent directory name contains glob
> characters like `(`, `)` or `[`. `npx jest --listTests` prints what it
> resolved without running anything.

---

## Purchase Orders

### Lifecycle

```
draft ──▶ submitted ──▶ partially_received ──▶ received
  │            │                  │
  └────────────┴──────────────────┴──▶ canceled   (only while nothing received)
```

Every transition is checked against an explicit allow-list in
`src/modules/purchase-order/statuses.ts`. Illegal jumps — receiving a PO that
was never submitted, submitting twice — return **400**, not a 500.

- **Create** (`draft`) — pick a supplier, a destination stock location, and add
  lines from Medusa's inventory items. Totals are always computed on the
  server; a `subtotal` or `total` in the request body is ignored.
- **Submit** — locks the lines and moves the PO to `submitted`. Draft only, and
  a PO with no lines cannot be submitted.
- **Receive** — per-line quantities, validated against what is still
  outstanding. Increases stocked quantity at the PO's location through the
  Inventory module, then flips the PO to `partially_received` or `received`
  depending on whether every line is complete. Safe to call once per delivery.
- **Update** — draft only. Omit `items` and the existing lines *and their
  totals* are left alone; send `items` and the lines are replaced and the
  totals recomputed.
- **Cancel** — refused as soon as any line has received stock, since that stock
  is already on the shelf.

### Routes

| Method | Route | Purpose |
|---|---|---|
| GET / POST | `/admin/suppliers` | List (paginated, `q` searches name) / create |
| GET / POST | `/admin/suppliers/:id` | Get / update |
| GET / POST | `/admin/purchase-orders` | List (`status`, `supplier_id`, `q`, `limit`, `offset`) / create |
| GET / POST | `/admin/purchase-orders/:id` | Get / update (draft only) |
| POST | `/admin/purchase-orders/:id/submit` | Submit a draft |
| POST | `/admin/purchase-orders/:id/receive` | Receive stock for one or more lines |
| POST | `/admin/purchase-orders/:id/cancel` | Cancel (blocked once stock received) |

---

## Inventory Transfers

### Lifecycle

```
draft ──▶ requested ──▶ in_transit ──▶ received
  │           │              │
  └───────────┴──────────────┴──▶ canceled   (in-transit stock returns to source)
```

- **Create** (`draft`) — source and destination must differ. The response
  carries `availability_warnings` for any line whose requested quantity exceeds
  what the source currently holds. That is a warning, not a rejection: a
  transfer is often drafted before the stock lands.
- **Request** — `draft → requested`, the paperwork step before dispatch.
- **Ship** — decreases stock at the source and sets `in_transit`. Refuses to
  ship more than the source actually has, so a transfer can never drive a
  location negative. **Shipping is allowed again while `in_transit`**, so a
  partial first shipment can send the balance later.
- **Receive** — increases stock at the destination. Outstanding is measured
  against `quantity_shipped`, **not** `quantity_requested` — this is what stops
  in-transit stock being counted at both ends. The transfer completes only when
  all shipped stock has been received *and* nothing is left to ship; pass
  `close_short: true` to close it anyway, which records the shortage in the
  notes.
- **Cancel** — allowed before shipping. After shipping, anything shipped but
  not yet received is returned to the source first.

### Routes

| Method | Route | Purpose |
|---|---|---|
| GET / POST | `/admin/inventory-transfers` | List (`status`, `from_location_id`, `to_location_id`, `q`, `limit`, `offset`) / create |
| GET / POST | `/admin/inventory-transfers/:id` | Get / update (draft only) |
| POST | `/admin/inventory-transfers/:id/request` | draft → requested |
| POST | `/admin/inventory-transfers/:id/ship` | Ship one or more lines |
| POST | `/admin/inventory-transfers/:id/receive` | Receive one or more lines |
| POST | `/admin/inventory-transfers/:id/cancel` | Cancel (returns in-transit stock) |

---

## How stock changes stay consistent

Each stock-moving operation is three steps, not one:

1. **Plan** — read the document, check the transition is legal, check every
   quantity, and work out the exact adjustments. Nothing is written, so a
   rejected request changes nothing at all.
2. **Adjust inventory** (`src/workflows/common/inventory-steps.ts`) — the only
   place in either module that touches stock. It has two rollback paths,
   because they cover different failures:
   - an inner `try/catch` reverses adjustments already applied if a later one in
     the same batch throws (a step's own compensation does *not* run when the
     step itself throws);
   - the step's compensation reverses the whole batch if a *later* step fails.
3. **Persist** — write the line quantities and the new status, with a
   compensation that restores the previous values.

So a failure at any point either moves all the stock and records it, or moves
none of it.

`ensureInventoryLevelsStep` creates an inventory level when an item has none at
a location yet — the normal state for the first receipt into a new warehouse —
and its compensation removes any it created.

### A note on idempotency

Receiving is **not** idempotent: replaying the same request receives that
quantity again, up to what is outstanding. What the module guarantees is that
you can never receive more than was ordered (or, for transfers, more than was
shipped), and that a failure never leaves stock and paperwork disagreeing. If
true replay-safety is needed, the next step is an idempotency key on the
receive endpoint.

## Validation

Every write route is validated by a zod schema in `src/api/validators.ts`,
wired up in `src/api/middlewares.ts`. Failures raise
`MedusaError.Types.INVALID_DATA`, which Medusa renders as a **400**, so a route
handler never sees malformed input.

Line items require an `inventory_item_id`. Both modules exist to move stock
through the Inventory module, and a line without one has nothing to adjust
against — the admin UI picks items from Medusa's inventory rather than taking
a free-text title.

## Layout

```
src/
  modules/
    purchase-order/      models, service, statuses.ts, types.ts
    inventory-transfer/  models, service, statuses.ts, types.ts
  workflows/
    common/              inventory-steps.ts, document-number.ts
    purchase-order/      create, update, submit, receive, cancel, supplier
    inventory-transfer/  create, update, request, ship, receive, cancel
  api/
    validators.ts        zod schemas for every route
    middlewares.ts       body validation wiring
    admin/               REST routes
  admin/
    components/          inventory-item-picker.tsx
    routes/              list / detail / create screens
```

Document numbers (`PO-1001`, `TR-1001`) come from the highest number already
issued, not from a row count — a count drops when a record is deleted and
reissues a number that already exists. The insert is retried on a unique
violation to cover two concurrent creates.

No API route mutates through a module service directly; every write goes
through a workflow.
