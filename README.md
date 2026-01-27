# Order Tracker Dashboard

A Next.js application deployed on Vercel that accepts order data iteratively, stores it in Supabase, and displays it in a beautiful dashboard with analytics.

## Features

- **API Endpoints** to receive order data (single or batch)
- **Supabase Integration** for persistent data storage
- **Beautiful Dashboard** with:
  - Order statistics (total orders, total spent, average order value)
  - Top 5 sellers by amount spent
  - Order status distribution chart
  - Detailed order list with items breakdown
  - Free delivery percentage tracking

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to the SQL Editor in your Supabase dashboard
3. Run the SQL script from `supabase-schema.sql` to create the orders table
4. Get your Supabase URL and Anon Key from Project Settings > API

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the dashboard.

## Deploy to Vercel

### Option 1: Via Vercel CLI

```bash
npm install -g vercel
vercel
```

### Option 2: Via Vercel Dashboard

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Add your environment variables in Project Settings
4. Deploy!

**Important:** Add these environment variables in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## API Usage

### Add Orders

**Endpoint:** `POST /api/orders/add`

**Single Order:**
```bash
curl -X POST http://localhost:3000/api/orders/add \
  -H "Content-Type: application/json" \
  -d '{
    "date": "Jan 27, 2026, 11:45 AM",
    "seller": "Example_Seller",
    "items": [
      {
        "product": "Product Name",
        "quantity": 1,
        "unit_price": 10.99,
        "total_price": 10.99
      }
    ],
    "delivery_cost": 0,
    "total": 10.99,
    "status": "In preparation"
  }'
```

**Multiple Orders:**
```bash
curl -X POST http://localhost:3000/api/orders/add \
  -H "Content-Type: application/json" \
  -d @data.json
```

### Get All Orders

**Endpoint:** `GET /api/orders/list`

```bash
curl http://localhost:3000/api/orders/list
```

## Project Structure

```
├── pages/
│   ├── api/
│   │   └── orders/
│   │       ├── add.ts       # API to add orders
│   │       └── list.ts      # API to fetch orders
│   ├── _app.tsx             # App wrapper
│   └── index.tsx            # Main page
├── src/
│   ├── components/
│   │   └── Dashboard.tsx    # Main dashboard component
│   ├── lib/
│   │   └── supabase.ts      # Supabase client
│   └── types/
│       └── index.ts         # TypeScript types
├── styles/
│   └── globals.css          # Global styles
└── data.json                # Sample order data
```

## Technologies Used

- **Next.js 14** - React framework optimized for Vercel
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Supabase** - PostgreSQL database
- **Recharts** - Data visualizations
- **date-fns** - Date formatting

## Sample Queries

Once your data is loaded, you can analyze it:

1. **Top 5 sellers by amount spent** - Visualized in bar chart
2. **Average order value** - Displayed in stats cards
3. **Order status distribution** - Visualized in pie chart
4. **Free delivery percentage** - Calculated and displayed
5. **All orders sorted by date** - Listed in detail view

## License

MIT
