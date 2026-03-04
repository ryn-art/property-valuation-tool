# Property Valuation Calculator (Income Approach)

## Overview
A web application for South African property valuation using the Income Approach (PGI -> EGI -> NOI -> Value). Valuations can be saved, loaded, modified, and deleted.

## Architecture
- **Frontend**: React + TypeScript with Tailwind CSS and Shadcn UI components
- **Backend**: Express.js with REST API routes
- **Database**: PostgreSQL via Drizzle ORM
- **State**: TanStack Query for server state, React useState for form state

## Key Files
- `client/src/pages/calculator.tsx` — Main calculator page with valuation logic, save/load UI
- `client/src/components/theme-provider.tsx` — Dark mode toggle with localStorage persistence
- `client/src/App.tsx` — App router with ThemeProvider
- `server/routes.ts` — CRUD API routes for valuations
- `server/storage.ts` — DatabaseStorage class implementing IStorage
- `server/db.ts` — PostgreSQL connection pool + Drizzle instance
- `shared/schema.ts` — Drizzle schema for users and valuations tables

## API Endpoints
- `GET /api/valuations` — List all (sorted by updatedAt desc)
- `GET /api/valuations/:id` — Get single valuation
- `POST /api/valuations` — Create new valuation
- `PATCH /api/valuations/:id` — Update existing valuation
- `DELETE /api/valuations/:id` — Delete valuation

## Database Schema
- `valuations` table: id (serial PK), name, propertyType, lines (jsonb), otherMonthly, actualAnnualRev, stabilisedOccPct, scenario, opexAnnual, utilityAdj, capLowPct, capHighPct, excessLand, refurb, createdAt, updatedAt

## Features
- Dynamic income line builder (description, area m², rate R/m²/month)
- Automatic PGI calculation at 100% occupancy
- Derived occupancy from actual annual revenue
- Dual scenario: Stabilised vs Actual
- Property type presets (Office 88%, Retail 92%, Industrial 95%, Storage 91%)
- NOI with opex and utility adjustments
- Value range using cap rate band (low/high)
- Save, load, rename, and delete valuations
- Dark mode with system preference detection
- Mobile responsive

## Running
`npm run dev` starts Express + Vite dev server
