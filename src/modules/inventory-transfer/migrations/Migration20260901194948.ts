import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260901194948 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "inventory_transfer" drop constraint if exists "inventory_transfer_transfer_number_unique";`);
    this.addSql(`create table if not exists "inventory_transfer" ("id" text not null, "transfer_number" text not null, "from_location_id" text not null, "to_location_id" text not null, "status" text check ("status" in ('draft', 'requested', 'in_transit', 'received', 'canceled')) not null default 'draft', "notes" text null, "shipped_at" timestamptz null, "received_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "inventory_transfer_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_inventory_transfer_transfer_number_unique" ON "inventory_transfer" ("transfer_number") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_inventory_transfer_deleted_at" ON "inventory_transfer" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "inventory_transfer_line_item" ("id" text not null, "inventory_item_id" text null, "variant_id" text null, "title" text not null, "sku" text null, "quantity_requested" integer not null, "quantity_shipped" integer not null default 0, "quantity_received" integer not null default 0, "transfer_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "inventory_transfer_line_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_inventory_transfer_line_item_transfer_id" ON "inventory_transfer_line_item" ("transfer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_inventory_transfer_line_item_deleted_at" ON "inventory_transfer_line_item" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "inventory_transfer_line_item" add constraint "inventory_transfer_line_item_transfer_id_foreign" foreign key ("transfer_id") references "inventory_transfer" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "inventory_transfer_line_item" drop constraint if exists "inventory_transfer_line_item_transfer_id_foreign";`);

    this.addSql(`drop table if exists "inventory_transfer" cascade;`);

    this.addSql(`drop table if exists "inventory_transfer_line_item" cascade;`);
  }

}
