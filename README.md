# Retirement Simulator (2026-ready)

A Hebrew RTL retirement simulation web app for an Israeli retirement advisor.

## Important
This package includes a **config file** for 2026 tax brackets and credit point value at:
- `app/data/tax_2026.json`

Because this environment has no web access, you must paste the official 2026 values into that file.
The UI will warn you until it's filled.

## Run locally
1. Install Node.js 18+
2. `npm install`
3. `npm run dev`

## Deploy (free, no coding)
- Vercel → New Project → Deploy with Drag & Drop → upload the ZIP of this project.

## Coefficients
Stored in `app/data/coefficients.json` with keys by:
- fund
- source type (מקיפה/משלימה/מנהלים/גמל להשקעה)
- gender
- retirement age
- spouse options key (S0 / S1_m{months}_p{percent})

You can send PDFs and we will extract and populate this file.
