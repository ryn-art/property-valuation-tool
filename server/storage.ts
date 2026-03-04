import { type User, type InsertUser, type Valuation, type InsertValuation, valuations } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listValuations(): Promise<Valuation[]>;
  getValuation(id: number): Promise<Valuation | undefined>;
  createValuation(data: InsertValuation): Promise<Valuation>;
  updateValuation(id: number, data: Partial<InsertValuation>): Promise<Valuation | undefined>;
  deleteValuation(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    return undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    return { ...insertUser, id };
  }

  async listValuations(): Promise<Valuation[]> {
    return db.select().from(valuations).orderBy(desc(valuations.updatedAt));
  }

  async getValuation(id: number): Promise<Valuation | undefined> {
    const [val] = await db.select().from(valuations).where(eq(valuations.id, id));
    return val;
  }

  async createValuation(data: InsertValuation): Promise<Valuation> {
    const [val] = await db.insert(valuations).values(data).returning();
    return val;
  }

  async updateValuation(id: number, data: Partial<InsertValuation>): Promise<Valuation | undefined> {
    const [val] = await db
      .update(valuations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(valuations.id, id))
      .returning();
    return val;
  }

  async deleteValuation(id: number): Promise<boolean> {
    const result = await db.delete(valuations).where(eq(valuations.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
