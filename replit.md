# Property Valuation Calculator (Income Approach)

## Overview
A web application for South African property valuation using the Income Approach. Supports two income models:
1. **Rental / Lease** — PGI → EGI → NOI → Value (m² × rate × occupancy)
2. **Hospitality** — Room types × seasonal rates × occupancy → EGI → NOI → Value

## Architecture
- **Frontend**: React + TypeScript with Tailwind CSS and Shadcn UI components
- **Backend**: Express.js with REST API routes
- **Database**: PostgreSQL via Drizzle ORM
- **State**: TanStack Query for server state, React useState for form state

## Key Files
- `client/src/pages/calculator.tsx` — Parent page: property type selector, save/load sidebar, state management
- `client/src/components/calculator-rental.tsx` — Rental/Lease calculator component
- `client/src/components/calculator-hospitality.tsx` — Hospitality calculator component (room types, seasons, rate matrix)
- `client/src/components/calculator-shared.tsx` — Shared helpers: StepBadge, KpiCard, money(), pct(), clamp(), formatDate()
- `client/src/components/theme-provider.tsx` — Dark mode toggle with localStorage persistence
- `client/src/App.tsx` — App router with ThemeProvider
- `server/routes.ts` — CRUD API routes for valuations
- `server/storage.ts` — DatabaseStorage class implementing IStorage
- `server/db.ts` — PostgreSQL connection pool + Drizzle instance
- `shared/schema.ts` — Drizzle schema, Zod schemas for IncomeLine, RoomType, Season, RateMatrix

## API Endpoints
- `GET /api/valuations` — List all (sorted by updatedAt desc)
- `GET /api/valuations/:id` — Get single valuation
- `POST /api/valuations` — Create new valuation
- `PATCH /api/valuations/:id` — Update existing valuation
- `DELETE /api/valuations/:id` — Delete valuation

## Database Schema
- `valuations` table: id (serial PK), name, incomeModel, propertyType, lines (jsonb), otherMonthly, actualAnnualRev, stabilisedOccPct, scenario, opexAnnual, utilityAdj, capLowPct, capHighPct, excessLand, refurb, roomTypes (jsonb), seasons (jsonb), rateMatrix (jsonb), otherAnnualIncome, createdAt, updatedAt

## Features
### Rental / Lease Mode
- Dynamic income line builder (description, area m², rate R/m²/month)
- Automatic PGI calculation at 100% occupancy
- Derived occupancy from actual annual revenue
- Dual scenario: Stabilised vs Actual
- Property type presets (Office 88%, Retail 92%, Industrial 95%, Storage 91%)

### Hospitality Mode
- Room types with name, count, and size (m²) — Total GLA calculation
- Seasons with date ranges (start/end) — auto-calculated nights
- Rate matrix: per room type × per season (R per night)
- Weighted ADR and weighted occupancy output
- Revenue breakdown table by season
- Actual vs Modelled Performance % indicator

### Shared
- NOI with opex and utility adjustments
- Value range using cap rate band (low/high) + excess land − refurb
- Save, load, rename, and delete valuations (PostgreSQL persistence)
- Print Summary button (window.print() with print media styles)
- Dark mode with system preference detection
- Mobile responsive

## Running
`npm run dev` starts Express + Vite dev server
