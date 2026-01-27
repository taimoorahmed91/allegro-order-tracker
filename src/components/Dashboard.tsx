import { useState, useEffect } from 'react';
import { Order } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSpent: 0,
    averageOrder: 0,
    freeDeliveryPercent: 0
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders/list');
      const result = await response.json();

      if (result.success) {
        setOrders(result.data);
        calculateStats(result.data);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (ordersData: Order[]) => {
    const totalOrders = ordersData.length;
    const totalSpent = ordersData.reduce((sum, order) => sum + order.total, 0);
    const averageOrder = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const freeDeliveryCount = ordersData.filter(order => order.delivery_cost === 0).length;
    const freeDeliveryPercent = totalOrders > 0 ? (freeDeliveryCount / totalOrders) * 100 : 0;

    setStats({
      totalOrders,
      totalSpent,
      averageOrder,
      freeDeliveryPercent
    });
  };

  const getSellerData = () => {
    const sellerMap = new Map<string, number>();

    orders.forEach(order => {
      const current = sellerMap.get(order.seller) || 0;
      sellerMap.set(order.seller, current + order.total);
    });

    return Array.from(sellerMap.entries())
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  const getStatusData = () => {
    const statusMap = new Map<string, number>();

    orders.forEach(order => {
      const current = statusMap.get(order.status) || 0;
      statusMap.set(order.status, current + 1);
    });

    return Array.from(statusMap.entries())
      .map(([name, value]) => ({ name, value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl font-semibold text-gray-600">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">Order Dashboard</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-sm text-gray-500 uppercase">Total Orders</div>
            <div className="text-3xl font-bold text-blue-600">{stats.totalOrders}</div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-sm text-gray-500 uppercase">Total Spent</div>
            <div className="text-3xl font-bold text-green-600">${stats.totalSpent.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-sm text-gray-500 uppercase">Average Order</div>
            <div className="text-3xl font-bold text-purple-600">${stats.averageOrder.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-sm text-gray-500 uppercase">Free Delivery</div>
            <div className="text-3xl font-bold text-indigo-600">{stats.freeDeliveryPercent.toFixed(0)}%</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Top Sellers Chart */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Top 5 Sellers by Amount</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getSellerData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" name="Amount ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Order Status Chart */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Order Status Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getStatusData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getStatusData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Recent Orders</h2>
          <div className="space-y-4">
            {orders.map((order, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-lg font-semibold text-gray-800">{order.seller}</div>
                    <div className="text-sm text-gray-500">{order.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">${order.total.toFixed(2)}</div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      order.status === 'Delivered' ? 'bg-green-100 text-green-800' :
                      order.status === 'In transit' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {order.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                      <span className="text-gray-700">{item.product}</span>
                      <span className="text-gray-600">
                        {item.quantity} x ${item.unit_price} = ${item.total_price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {order.delivery_cost > 0 && (
                  <div className="text-sm text-gray-600 mt-2">
                    Delivery Cost: ${order.delivery_cost.toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
