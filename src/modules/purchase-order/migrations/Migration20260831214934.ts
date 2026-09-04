import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260831214934 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "purchase_order" drop constraint if exists "purchase_order_po_number_unique";`);
    this.addSql(`create table if not exists "purchase_order" ("id" text not null, "po_number" text not null, "supplier_id" text not null, "stock_location_id" text not null, "status" text check ("status" in ('draft', 'submitted', 'partially_received', 'received', 'canceled')) not null default 'draft', "currency_code" text not null, "expected_delivery" timestamptz null, "subtotal" numeric not null default 0, "tax_total" numeric not null default 0, "shipping_total" numeric not null default 0, "total" numeric not null default 0, "notes" text null, "raw_subtotal" jsonb not null default '{"value":"0","precision":20}', "raw_tax_total" jsonb not null default '{"value":"0","precision":20}', "raw_shipping_total" jsonb not null default '{"value":"0","precision":20}', "raw_total" jsonb not null default '{"value":"0","precision":20}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "purchase_order_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_purchase_order_po_number_unique" ON "purchase_order" ("po_number") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_purchase_order_deleted_at" ON "purchase_order" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "purchase_order_line_item" ("id" text not null, "variant_id" text null, "inventory_item_id" text null, "title" text not null, "sku" text null, "quantity_ordered" integer not null, "quantity_received" integer not null default 0, "unit_cost" numeric not null, "line_total" numeric not null, "purchase_order_id" text not null, "raw_unit_cost" jsonb not null, "raw_line_total" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "purchase_order_line_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_purchase_order_line_item_purchase_order_id" ON "purchase_order_line_item" ("purchase_order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_purchase_order_line_item_deleted_at" ON "purchase_order_line_item" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "supplier" ("id" text not null, "name" text not null, "email" text null, "phone" text null, "address" text null, "currency_code" text not null, "notes" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "supplier_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_supplier_deleted_at" ON "supplier" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "purchase_order_line_item" add constraint "purchase_order_line_item_purchase_order_id_foreign" foreign key ("purchase_order_id") references "purchase_order" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "purchase_order_line_item" drop constraint if exists "purchase_order_line_item_purchase_order_id_foreign";`);

    this.addSql(`drop table if exists "purchase_order" cascade;`);

    this.addSql(`drop table if exists "purchase_order_line_item" cascade;`);

    this.addSql(`drop table if exists "supplier" cascade;`);
  }

}
