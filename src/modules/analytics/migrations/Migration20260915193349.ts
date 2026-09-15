import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260915193349 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "analytics_snapshot" ("id" text not null, "store_id" text not null, "date" timestamptz not null, "revenue" real not null default 0, "orders_count" integer not null default 0, "top_products" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_snapshot_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_snapshot_deleted_at" ON "analytics_snapshot" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "analytics_snapshot" cascade;`);
  }

}
