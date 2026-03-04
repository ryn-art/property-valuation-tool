import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertValuationSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/valuations", async (_req, res) => {
    const list = await storage.listValuations();
    res.json(list);
  });

  app.get("/api/valuations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

    const val = await storage.getValuation(id);
    if (!val) return res.status(404).json({ message: "Not found" });
    res.json(val);
  });

  app.post("/api/valuations", async (req, res) => {
    const parsed = insertValuationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
    }
    const val = await storage.createValuation(parsed.data);
    res.status(201).json(val);
  });

  app.patch("/api/valuations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

    const partial = insertValuationSchema.partial().safeParse(req.body);
    if (!partial.success) {
      return res.status(400).json({ message: "Validation error", errors: partial.error.flatten() });
    }
    const val = await storage.updateValuation(id, partial.data);
    if (!val) return res.status(404).json({ message: "Not found" });
    res.json(val);
  });

  app.delete("/api/valuations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

    const deleted = await storage.deleteValuation(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.status(204).send();
  });

  return httpServer;
}
