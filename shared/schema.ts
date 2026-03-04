import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, jsonb, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const incomeLineSchema = z.object({
  id: z.number(),
  desc: z.string(),
  size: z.number(),
  rate: z.number(),
});

export type IncomeLine = z.infer<typeof incomeLineSchema>;

export const valuations = pgTable("valuations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Untitled Valuation"),
  propertyType: text("property_type").notNull().default("office"),
  lines: jsonb("lines").notNull().default([]),
  otherMonthly: real("other_monthly").notNull().default(0),
  actualAnnualRev: real("actual_annual_rev").notNull().default(0),
  stabilisedOccPct: real("stabilised_occ_pct").notNull().default(88),
  scenario: text("scenario").notNull().default("stabilised"),
  opexAnnual: real("opex_annual").notNull().default(0),
  utilityAdj: real("utility_adj").notNull().default(0),
  capLowPct: real("cap_low_pct").notNull().default(12),
  capHighPct: real("cap_high_pct").notNull().default(13.5),
  excessLand: real("excess_land").notNull().default(0),
  refurb: real("refurb").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertValuationSchema = createInsertSchema(valuations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  lines: z.array(incomeLineSchema).default([]),
  name: z.string().min(1).default("Untitled Valuation"),
  propertyType: z.enum(["office", "retail", "industrial", "storage", "other"]).default("office"),
  scenario: z.enum(["stabilised", "actual"]).default("stabilised"),
});

export type InsertValuation = z.infer<typeof insertValuationSchema>;
export type Valuation = typeof valuations.$inferSelect;
