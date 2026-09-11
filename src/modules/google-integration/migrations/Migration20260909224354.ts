import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260909224354 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "google_connection" ("id" text not null, "store_id" text not null, "merchant_account_id" text null, "credentials" jsonb null, "status" text check ("status" in ('connected', 'disconnected', 'error')) not null default 'disconnected', "last_synced_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "google_connection_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_google_connection_deleted_at" ON "google_connection" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "google_connection" cascade;`);
  }

}
