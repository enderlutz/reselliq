# ResellIQ

All-in-one platform for resellers. Inventory, accounting, investor dashboard, sourcing intelligence.

## Stack
- **Backend**: FastAPI + SQLAlchemy + SQLite
- **Frontend**: React + Vite + TypeScript + shadcn/ui + Tailwind

## Setup

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Visit http://localhost:5173.

## Default credentials (seeded on first run)
- Owner: `owner@reselliq.local` / `password`
- Investor: `investor@reselliq.local` / `password`

## Profit Split
- Investor fronts retail cost.
- On sale: `net_profit = sale_price - retail_cost - fees - shipping_out - sales_tax_collected`
- Investor: `retail_cost + (net_profit * 0.60)` — capital returned + 60% of net.
- Owner: `net_profit * 0.40` — 40% of net.
