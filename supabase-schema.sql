-- Create the orders table in Supabase
CREATE TABLE orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date text NOT NULL,
  seller text NOT NULL,
  items jsonb NOT NULL,
  delivery_cost decimal(10,2) NOT NULL,
  total decimal(10,2) NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create an index on the date column for faster sorting
CREATE INDEX idx_orders_date ON orders(date);

-- Create an index on the seller column for faster filtering
CREATE INDEX idx_orders_seller ON orders(seller);

-- Create an index on the status column for faster filtering
CREATE INDEX idx_orders_status ON orders(status);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (adjust as needed for your security requirements)
CREATE POLICY "Enable all operations for authenticated users" ON orders
  FOR ALL
  USING (true)
  WITH CHECK (true);
