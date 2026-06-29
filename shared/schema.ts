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
  qty: z.number().default(1),
  climateControlled: z.boolean().default(false),
});

export type IncomeLine = z.infer<typeof incomeLineSchema>;

export const roomTypeSchema = z.object({
  id: z.number(),
  name: z.string(),
  rooms: z.number(),
  sizeSqm: z.number(),
});

export type RoomType = z.infer<typeof roomTypeSchema>;

export const seasonSchema = z.object({
  id: z.number(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  occupancyPct: z.number(),
});

export type Season = z.infer<typeof seasonSchema>;

export const expenseLineSchema = z.object({
  id: z.number(),
  group: z.string().default("Operating Expenses"),
  label: z.string(),
  monthly: z.number().default(0),
  recovery: z.number().default(0),
});

export type ExpenseLine = z.infer<typeof expenseLineSchema>;

export const rateMatrixSchema = z.record(z.string(), z.number());

export type RateMatrix = z.infer<typeof rateMatrixSchema>;

export const valuations = pgTable("valuations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Untitled Valuation"),
  incomeModel: text("income_model").notNull().default("rental"),
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
  unusedLandSize: real("unused_land_size").notNull().default(0),
  landValuePerM2: real("land_value_per_m2").notNull().default(0),
  refurb: real("refurb").notNull().default(0),
  roomTypes: jsonb("room_types").notNull().default([]),
  seasons: jsonb("seasons").notNull().default([]),
  rateMatrix: jsonb("rate_matrix").notNull().default({}),
  expenseLines: jsonb("expense_lines").notNull().default([]),
  otherAnnualIncome: real("other_annual_income").notNull().default(0),
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
  incomeModel: z.enum(["rental", "hospitality"]).default("rental"),
  propertyType: z.enum(["office", "retail", "industrial", "storage", "student", "other"]).default("office"),
  scenario: z.enum(["stabilised", "actual"]).default("stabilised"),
  roomTypes: z.array(roomTypeSchema).default([]),
  seasons: z.array(seasonSchema).default([]),
  rateMatrix: rateMatrixSchema.default({}),
  expenseLines: z.array(expenseLineSchema).default([]),
  otherAnnualIncome: z.number().default(0),
});

export type InsertValuation = z.infer<typeof insertValuationSchema>;
export type Valuation = typeof valuations.$inferSelect;
