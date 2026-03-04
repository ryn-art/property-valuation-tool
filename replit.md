# Property Valuation Calculator (Income Approach)

## Overview
A single-page web application for South African property valuation using the Income Approach (PGI → EGI → NOI → Value). No backend data persistence needed — all calculations are client-side.

## Architecture
- **Frontend**: React + TypeScript with Tailwind CSS and Shadcn UI components
- **Backend**: Express.js (serves the static frontend only, no API routes needed)
- **No database required** — this is a pure client-side calculator

## Key Files
- `client/src/pages/calculator.tsx` — Main calculator page with all valuation logic
- `client/src/App.tsx` — App router, renders calculator at `/`

## Features
- Dynamic income line builder (description, area m², rate R/m²/month)
- Automatic PGI calculation at 100% occupancy
- Derived occupancy from actual annual revenue
- Dual scenario: Stabilised (market occupancy) vs Actual (collected revenue)
- Property type presets (Office 88%, Retail 92%, Industrial 95%, Storage 91%)
- NOI with opex and utility adjustments
- Value range using cap rate band (low/high)
- Excess land and refurb adjustments
- Real-time recalculation
- South African currency formatting (R with 2 decimals)
- Reset all functionality
- Mobile responsive

## Running
`npm run dev` starts Express + Vite dev server
