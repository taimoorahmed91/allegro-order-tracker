export interface OrderItem {
  product: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Order {
  id?: string;
  date: string;
  seller: string;
  items: OrderItem[];
  delivery_cost: number;
  total: number;
  status: string;
  created_at?: string;
}
