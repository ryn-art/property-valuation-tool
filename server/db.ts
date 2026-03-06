import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS valuations (
        id serial PRIMARY KEY,
        name text NOT NULL DEFAULT 'Untitled Valuation',
        income_model text NOT NULL DEFAULT 'rental',
        property_type text NOT NULL DEFAULT 'office',
        lines jsonb NOT NULL DEFAULT '[]',
        other_monthly real NOT NULL DEFAULT 0,
        actual_annual_rev real NOT NULL DEFAULT 0,
        stabilised_occ_pct real NOT NULL DEFAULT 88,
        scenario text NOT NULL DEFAULT 'stabilised',
        opex_annual real NOT NULL DEFAULT 0,
        utility_adj real NOT NULL DEFAULT 0,
        cap_low_pct real NOT NULL DEFAULT 12,
        cap_high_pct real NOT NULL DEFAULT 13.5,
        unused_land_size real NOT NULL DEFAULT 0,
        land_value_per_m2 real NOT NULL DEFAULT 0,
        refurb real NOT NULL DEFAULT 0,
        room_types jsonb NOT NULL DEFAULT '[]',
        seasons jsonb NOT NULL DEFAULT '[]',
        rate_matrix jsonb NOT NULL DEFAULT '{}',
        other_annual_income real NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
      ALTER TABLE valuations ADD COLUMN IF NOT EXISTS income_model text NOT NULL DEFAULT 'rental';
      ALTER TABLE valuations ADD COLUMN IF NOT EXISTS unused_land_size real NOT NULL DEFAULT 0;
      ALTER TABLE valuations ADD COLUMN IF NOT EXISTS land_value_per_m2 real NOT NULL DEFAULT 0;
      ALTER TABLE valuations ADD COLUMN IF NOT EXISTS room_types jsonb NOT NULL DEFAULT '[]';
      ALTER TABLE valuations ADD COLUMN IF NOT EXISTS seasons jsonb NOT NULL DEFAULT '[]';
      ALTER TABLE valuations ADD COLUMN IF NOT EXISTS rate_matrix jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE valuations ADD COLUMN IF NOT EXISTS other_annual_income real NOT NULL DEFAULT 0;
    `);
  } finally {
    client.release();
  }
}
