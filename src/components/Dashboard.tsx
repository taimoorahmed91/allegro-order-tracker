import { useState, useEffect } from 'react';
import { Order } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parse, format } from 'date-fns';

interface DashboardProps {
  username: string;
  onLogout: () => void;
}

export default function Dashboard({ username, onLogout }: DashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    seller: '',
    product: '',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    minTotal: '',
    maxTotal: ''
  });
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSpent: 0,
    averageOrder: 0,
    freeDeliveryPercent: 0,
    avgMonthlySpend: 0,
    thisMonthSpend: 0
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders/list');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      if (!text) {
        console.log('No data returned from API');
        setOrders([]);
        calculateStats([]);
        return;
      }

      const result = JSON.parse(text);

      if (result.success) {
        setOrders(result.data || []);
        calculateStats(result.data || []);
      } else {
        setOrders([]);
        calculateStats([]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
      calculateStats([]);
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

    // Calculate monthly spending
    const monthlyMap = new Map<string, number>();
    const currentMonth = format(new Date(), 'MMM yyyy');

    ordersData.forEach(order => {
      try {
        const parsedDate = parse(order.date, 'MMM dd, yyyy, hh:mm a', new Date());
        const monthKey = format(parsedDate, 'MMM yyyy');
        const current = monthlyMap.get(monthKey) || 0;
        monthlyMap.set(monthKey, current + order.total);
      } catch (error) {
        console.error('Error parsing date:', order.date);
      }
    });

    const avgMonthlySpend = monthlyMap.size > 0
      ? Array.from(monthlyMap.values()).reduce((sum, val) => sum + val, 0) / monthlyMap.size
      : 0;

    const thisMonthSpend = monthlyMap.get(currentMonth) || 0;

    setStats({
      totalOrders,
      totalSpent,
      averageOrder,
      freeDeliveryPercent,
      avgMonthlySpend,
      thisMonthSpend
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMessage(null);

    try {
      const fileContent = await file.text();
      const jsonData = JSON.parse(fileContent);

      if (!Array.isArray(jsonData)) {
        throw new Error('Invalid JSON format. Expected an array of orders.');
      }

      const response = await fetch('/api/orders/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jsonData)
      });

      const text = await response.text();
      const result = text ? JSON.parse(text) : {};

      if (response.ok || response.status === 207) {
        const insertedCount = result.inserted || 0;
        const updatedCount = result.updated || 0;
        const failedCount = result.failed || 0;

        let message = '';
        if (insertedCount > 0 && updatedCount > 0) {
          message = `Successfully imported ${insertedCount} new orders and updated ${updatedCount} existing orders!`;
        } else if (insertedCount > 0) {
          message = `Successfully imported ${insertedCount} new orders!`;
        } else if (updatedCount > 0) {
          message = `Successfully updated ${updatedCount} existing orders!`;
        } else {
          message = 'All orders are already up to date!';
        }

        if (failedCount > 0) {
          message += ` (${failedCount} failed)`;
        }

        setUploadMessage({
          type: 'success',
          text: message
        });
        // Refresh orders list
        fetchOrders();
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to upload orders'
      });
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleDelete = async (orderId: string) => {
    try {
      const response = await fetch(`/api/orders/delete?id=${orderId}`, {
        method: 'DELETE',
      });

      const text = await response.text();
      const result = text ? JSON.parse(text) : {};

      if (response.ok) {
        setUploadMessage({
          type: 'success',
          text: 'Order deleted successfully!'
        });
        fetchOrders();
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      setUploadMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete order'
      });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleUpdate = async (updatedOrder: Order) => {
    try {
      const response = await fetch('/api/orders/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedOrder)
      });

      const text = await response.text();
      const result = text ? JSON.parse(text) : {};

      if (response.ok) {
        setUploadMessage({
          type: 'success',
          text: 'Order updated successfully!'
        });
        fetchOrders();
        setEditingOrder(null);
      } else {
        throw new Error(result.error || 'Update failed');
      }
    } catch (error) {
      console.error('Update error:', error);
      setUploadMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update order'
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOrders.length === 0) return;

    try {
      const deletePromises = selectedOrders.map(orderId =>
        fetch(`/api/orders/delete?id=${orderId}`, { method: 'DELETE' })
      );

      await Promise.all(deletePromises);

      setUploadMessage({
        type: 'success',
        text: `Successfully deleted ${selectedOrders.length} order(s)!`
      });
      setSelectedOrders([]);
      fetchOrders();
    } catch (error) {
      console.error('Bulk delete error:', error);
      setUploadMessage({
        type: 'error',
        text: 'Failed to delete some orders'
      });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleDeleteAll = async () => {
    try {
      const deletePromises = orders.map(order =>
        fetch(`/api/orders/delete?id=${order.id}`, { method: 'DELETE' })
      );

      await Promise.all(deletePromises);

      setUploadMessage({
        type: 'success',
        text: `Successfully deleted all ${orders.length} order(s)!`
      });
      setSelectedOrders([]);
      fetchOrders();
    } catch (error) {
      console.error('Delete all error:', error);
      setUploadMessage({
        type: 'error',
        text: 'Failed to delete all orders'
      });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleAddOrder = async (newOrder: Omit<Order, 'id' | 'created_at'>) => {
    try {
      const response = await fetch('/api/orders/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newOrder)
      });

      const text = await response.text();
      const result = text ? JSON.parse(text) : {};

      if (response.ok) {
        setUploadMessage({
          type: 'success',
          text: 'Order added successfully!'
        });
        fetchOrders();
        setShowAddModal(false);
      } else {
        throw new Error(result.error || 'Failed to add order');
      }
    } catch (error) {
      console.error('Add order error:', error);
      setUploadMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to add order'
      });
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    const currentPageOrders = getPaginatedOrders();
    const currentPageIds = currentPageOrders.map(order => order.id).filter(Boolean) as string[];

    if (currentPageIds.every(id => selectedOrders.includes(id))) {
      // Deselect all on current page
      setSelectedOrders(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      // Select all on current page
      const combined = [...selectedOrders, ...currentPageIds];
      const uniqueIds = Array.from(new Set(combined));
      setSelectedOrders(uniqueIds);
    }
  };

  const isAllSelected = () => {
    const currentPageOrders = getPaginatedOrders();
    const currentPageIds = currentPageOrders.map(order => order.id).filter(Boolean) as string[];
    return currentPageIds.length > 0 && currentPageIds.every(id => selectedOrders.includes(id));
  };

  const getFilteredAndSortedOrders = () => {
    let filtered = [...orders];

    // Sort by date (latest first)
    filtered.sort((a, b) => {
      try {
        const dateA = parse(a.date, 'MMM dd, yyyy, hh:mm a', new Date());
        const dateB = parse(b.date, 'MMM dd, yyyy, hh:mm a', new Date());
        return dateB.getTime() - dateA.getTime();
      } catch {
        return 0;
      }
    });

    // Filter by seller
    if (filters.seller) {
      filtered = filtered.filter(order =>
        order.seller.toLowerCase().includes(filters.seller.toLowerCase())
      );
    }

    // Filter by product
    if (filters.product) {
      filtered = filtered.filter(order =>
        order.items.some(item =>
          item.product.toLowerCase().includes(filters.product.toLowerCase())
        )
      );
    }

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(order => order.status === filters.status);
    }

    // Filter by date range
    if (filters.dateFrom || filters.dateTo) {
      filtered = filtered.filter(order => {
        try {
          const orderDate = parse(order.date, 'MMM dd, yyyy, hh:mm a', new Date());

          if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            if (orderDate < fromDate) return false;
          }

          if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            if (orderDate > toDate) return false;
          }

          return true;
        } catch {
          return true;
        }
      });
    }

    // Filter by total amount range
    if (filters.minTotal) {
      filtered = filtered.filter(order => order.total >= parseFloat(filters.minTotal));
    }
    if (filters.maxTotal) {
      filtered = filtered.filter(order => order.total <= parseFloat(filters.maxTotal));
    }

    return filtered;
  };

  const getPaginatedOrders = () => {
    const filtered = getFilteredAndSortedOrders();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    return Math.ceil(getFilteredAndSortedOrders().length / itemsPerPage);
  };

  const getPageNumbers = () => {
    const totalPages = getTotalPages();
    const current = currentPage;
    const pages: (number | string)[] = [];

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (current > 3) {
        pages.push('...');
      }

      // Show pages around current
      const start = Math.max(2, current - 1);
      const end = Math.min(totalPages - 1, current + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (current < totalPages - 2) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const getMonthlySpending = () => {
    const monthlyMap = new Map<string, number>();

    orders.forEach(order => {
      try {
        // Parse the date string (e.g., "Jan 27, 2026, 11:45 AM")
        const dateStr = order.date;
        const parsedDate = parse(dateStr, 'MMM dd, yyyy, hh:mm a', new Date());
        const monthKey = format(parsedDate, 'MMM yyyy');

        const current = monthlyMap.get(monthKey) || 0;
        monthlyMap.set(monthKey, current + order.total);
      } catch (error) {
        console.error('Error parsing date:', order.date);
      }
    });

    // Convert to array and sort by date
    return Array.from(monthlyMap.entries())
      .map(([month, total]) => ({
        month,
        total: parseFloat(total.toFixed(2))
      }))
      .sort((a, b) => {
        const dateA = parse(a.month, 'MMM yyyy', new Date());
        const dateB = parse(b.month, 'MMM yyyy', new Date());
        return dateA.getTime() - dateB.getTime();
      });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-2xl font-semibold text-gray-300">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Order Dashboard</h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="text-sm sm:text-base text-gray-300">
              Welcome, <span className="text-white font-semibold">{username}</span>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 border border-gray-700">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Import Orders</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <label className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg cursor-pointer hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg text-sm sm:text-base whitespace-nowrap">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {uploading ? 'Uploading...' : 'Choose JSON File'}
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
            <span className="text-xs sm:text-sm text-gray-400 text-center sm:text-left">
              Select allegro_purchases.json or data.json to import orders
            </span>
          </div>

          {uploadMessage && (
            <div className={`mt-4 p-4 rounded-lg ${
              uploadMessage.type === 'success'
                ? 'bg-green-900 border border-green-700 text-green-200'
                : 'bg-red-900 border border-red-700 text-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {uploadMessage.type === 'success' ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="font-semibold">{uploadMessage.text}</span>
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border border-gray-700">
            <div className="text-xs sm:text-sm text-gray-400 uppercase">Total Orders</div>
            <div className="text-2xl sm:text-3xl font-bold text-blue-400">{stats.totalOrders}</div>
          </div>
          <div className="bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border border-gray-700">
            <div className="text-xs sm:text-sm text-gray-400 uppercase">Total Spent</div>
            <div className="text-2xl sm:text-3xl font-bold text-green-400">{stats.totalSpent.toFixed(2)} zł</div>
          </div>
          <div className="bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border border-gray-700">
            <div className="text-xs sm:text-sm text-gray-400 uppercase">Average Order</div>
            <div className="text-2xl sm:text-3xl font-bold text-purple-400">{stats.averageOrder.toFixed(2)} zł</div>
          </div>
          <div className="bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border border-gray-700">
            <div className="text-xs sm:text-sm text-gray-400 uppercase">Free Delivery</div>
            <div className="text-2xl sm:text-3xl font-bold text-indigo-400">{stats.freeDeliveryPercent.toFixed(0)}%</div>
          </div>
          <div className="bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border border-gray-700">
            <div className="text-xs sm:text-sm text-gray-400 uppercase">Avg Monthly Spend</div>
            <div className="text-2xl sm:text-3xl font-bold text-yellow-400">{stats.avgMonthlySpend.toFixed(2)} zł</div>
          </div>
          <div className="bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border border-gray-700">
            <div className="text-xs sm:text-sm text-gray-400 uppercase">This Month Spend</div>
            <div className="text-2xl sm:text-3xl font-bold text-pink-400">{stats.thisMonthSpend.toFixed(2)} zł</div>
          </div>
        </div>

        {/* Monthly Spending Chart */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 border border-gray-700">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-4 sm:mb-6">Monthly Spending Trends</h2>
          <div className="w-full overflow-x-auto">
            <ResponsiveContainer width="100%" height={300} minWidth={300} className="sm:!h-[350px] lg:!h-[400px]">
              <LineChart data={getMonthlySpending()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="month"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  stroke="#9CA3AF"
                  style={{ fontSize: '0.75rem' }}
                />
                <YAxis stroke="#9CA3AF" style={{ fontSize: '0.75rem' }} />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(2)} zł`}
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#fff', fontSize: '0.875rem' }}
                />
                <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#60A5FA"
                  strokeWidth={2}
                  name="Total Spending (zł)"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Recent Orders</h2>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Add New Order</span>
                <span className="sm:hidden">Add Order</span>
              </button>
              {selectedOrders.length > 0 && (
                <button
                  onClick={() => setDeleteConfirm('bulk')}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs sm:text-sm"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete ({selectedOrders.length})
                </button>
              )}
              {orders.length > 0 && (
                <button
                  onClick={() => setDeleteConfirm('all')}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors text-xs sm:text-sm"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="hidden sm:inline">Delete All</span>
                  <span className="sm:hidden">All</span>
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Seller Filter */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Seller</label>
                <input
                  type="text"
                  placeholder="Filter by seller..."
                  value={filters.seller}
                  onChange={(e) => {
                    setFilters({...filters, seller: e.target.value});
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Product Filter */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Product</label>
                <input
                  type="text"
                  placeholder="Filter by product..."
                  value={filters.product}
                  onChange={(e) => {
                    setFilters({...filters, product: e.target.value});
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => {
                    setFilters({...filters, status: e.target.value});
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Statuses</option>
                  <option value="In preparation">In Preparation</option>
                  <option value="In transit">In Transit</option>
                  <option value="Picked up">Picked up</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Clear Filters Button */}
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilters({
                      seller: '',
                      product: '',
                      status: 'all',
                      dateFrom: '',
                      dateTo: '',
                      minTotal: '',
                      maxTotal: ''
                    });
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {/* Date Range and Amount Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Date From</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => {
                      setFilters({...filters, dateFrom: e.target.value});
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Date To</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => {
                      setFilters({...filters, dateTo: e.target.value});
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Amount Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Min Total (zł)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Min"
                    value={filters.minTotal}
                    onChange={(e) => {
                      setFilters({...filters, minTotal: e.target.value});
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Max Total (zł)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Max"
                    value={filters.maxTotal}
                    onChange={(e) => {
                      setFilters({...filters, maxTotal: e.target.value});
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Select All */}
          {getPaginatedOrders().length > 0 && (
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700">
              <input
                type="checkbox"
                checked={isAllSelected()}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
              />
              <label className="text-sm text-gray-300">
                Select all on this page
              </label>
            </div>
          )}

          <div className="space-y-3 sm:space-y-4">
            {getPaginatedOrders().map((order, index) => (
              <div key={index} className={`border rounded-lg p-3 sm:p-4 transition-all ${
                selectedOrders.includes(order.id || '')
                  ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                  : 'border-gray-700 bg-gray-750 hover:border-gray-600'
              }`}>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2 sm:gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.id || '')}
                      onChange={() => toggleOrderSelection(order.id || '')}
                      className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-base sm:text-lg font-semibold text-white truncate">{order.seller}</div>
                      <div className="text-xs sm:text-sm text-gray-400">{order.date}</div>
                    </div>
                  </div>
                  <div className="flex items-start justify-between sm:justify-start gap-3 pl-6 sm:pl-0">
                    <div className="text-left sm:text-right">
                      <div className="text-xl sm:text-2xl font-bold text-green-400">{order.total.toFixed(2)} zł</div>
                      <span className={`inline-block px-2 sm:px-3 py-1 rounded-full text-xs font-semibold mt-1 ${
                        order.status === 'Picked up' ? 'bg-green-900 text-green-300 border border-green-700' :
                        order.status === 'In transit' ? 'bg-blue-900 text-blue-300 border border-blue-700' :
                        'bg-yellow-900 text-yellow-300 border border-yellow-700'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                      <button
                        onClick={() => setEditingOrder(order)}
                        className="p-1.5 sm:p-2 text-blue-400 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Edit order"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(order.id || '')}
                        className="p-1.5 sm:p-2 text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Delete order"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pl-0 sm:pl-7">
                  {order.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex flex-col sm:flex-row sm:justify-between gap-1 text-xs sm:text-sm bg-gray-700 p-2 rounded">
                      <span className="text-gray-200 font-medium truncate">{item.product}</span>
                      <span className="text-gray-300 whitespace-nowrap">
                        {item.quantity} x {item.unit_price} zł = {item.total_price.toFixed(2)} zł
                      </span>
                    </div>
                  ))}
                </div>

                {order.delivery_cost > 0 && (
                  <div className="text-xs sm:text-sm text-gray-400 mt-2 pl-0 sm:pl-7">
                    Delivery Cost: {order.delivery_cost.toFixed(2)} zł
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Rows per page and Pagination */}
          {getFilteredAndSortedOrders().length > 0 && (
            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs sm:text-sm text-gray-400">Rows per page:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(parseInt(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 sm:px-3 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="10">10</option>
                    <option value="15">15</option>
                    <option value="20">20</option>
                    <option value="30">30</option>
                  </select>
                </div>
                {getTotalPages() > 1 && (
                <div className="flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-2 sm:px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm whitespace-nowrap"
                >
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">Prev</span>
                </button>
                <div className="flex gap-1">
                  {getPageNumbers().map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-2 sm:px-3 py-2 text-gray-400 text-xs sm:text-sm">
                        ...
                      </span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page as number)}
                        className={`px-2 sm:px-3 py-2 rounded-lg transition-colors min-w-[32px] sm:min-w-[40px] text-xs sm:text-sm ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(getTotalPages(), prev + 1))}
                  disabled={currentPage === getTotalPages()}
                  className="px-2 sm:px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm whitespace-nowrap"
                >
                  Next
                </button>
                </div>
                )}
              </div>
              {getTotalPages() > 1 && (
              <div className="text-center text-xs sm:text-sm text-gray-400">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, getFilteredAndSortedOrders().length)} of {getFilteredAndSortedOrders().length} orders
              </div>
              )}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Confirm Delete</h3>
              <p className="text-sm sm:text-base text-gray-300 mb-4 sm:mb-6">
                {deleteConfirm === 'bulk'
                  ? `Are you sure you want to delete ${selectedOrders.length} selected order(s)? This action cannot be undone.`
                  : deleteConfirm === 'all'
                  ? `Are you sure you want to delete ALL ${orders.length} order(s)? This action cannot be undone.`
                  : 'Are you sure you want to delete this order? This action cannot be undone.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors text-sm sm:text-base order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    deleteConfirm === 'bulk' ? handleBulkDelete() :
                    deleteConfirm === 'all' ? handleDeleteAll() :
                    handleDelete(deleteConfirm)
                  }
                  className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors text-sm sm:text-base order-1 sm:order-2"
                >
                  Delete {deleteConfirm === 'bulk' ? `${selectedOrders.length}` : deleteConfirm === 'all' ? 'All' : ''}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Order Modal */}
        {editingOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setEditingOrder(null)}>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-6 max-w-2xl w-full my-4 sm:my-8" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Edit Order</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleUpdate(editingOrder);
              }}>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">Seller</label>
                    <input
                      type="text"
                      value={editingOrder.seller}
                      onChange={(e) => setEditingOrder({...editingOrder, seller: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">Date</label>
                    <input
                      type="text"
                      value={editingOrder.date}
                      onChange={(e) => setEditingOrder({...editingOrder, date: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">Status</label>
                    <select
                      value={editingOrder.status}
                      onChange={(e) => setEditingOrder({...editingOrder, status: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                      required
                    >
                      <option value="In preparation">In preparation</option>
                      <option value="In transit">In transit</option>
                      <option value="Picked up">Picked up</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">Delivery Cost (zł)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingOrder.delivery_cost}
                        onChange={(e) => setEditingOrder({...editingOrder, delivery_cost: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">Total (zł)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingOrder.total}
                        onChange={(e) => setEditingOrder({...editingOrder, total: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Items</label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {editingOrder.items.map((item, idx) => (
                        <div key={idx} className="bg-gray-700 p-2 sm:p-3 rounded-lg border border-gray-600">
                          <input
                            type="text"
                            value={item.product}
                            onChange={(e) => {
                              const newItems = [...editingOrder.items];
                              newItems[idx].product = e.target.value;
                              setEditingOrder({...editingOrder, items: newItems});
                            }}
                            className="w-full px-2 py-1 mb-2 bg-gray-600 border border-gray-500 text-white rounded text-xs sm:text-sm"
                            placeholder="Product name"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const newItems = [...editingOrder.items];
                                newItems[idx].quantity = parseInt(e.target.value);
                                setEditingOrder({...editingOrder, items: newItems});
                              }}
                              className="px-2 py-1 bg-gray-600 border border-gray-500 text-white rounded text-xs sm:text-sm"
                              placeholder="Qty"
                            />
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => {
                                const newItems = [...editingOrder.items];
                                newItems[idx].unit_price = parseFloat(e.target.value);
                                setEditingOrder({...editingOrder, items: newItems});
                              }}
                              className="px-2 py-1 bg-gray-600 border border-gray-500 text-white rounded text-xs sm:text-sm"
                              placeholder="Price"
                            />
                            <input
                              type="number"
                              step="0.01"
                              value={item.total_price}
                              onChange={(e) => {
                                const newItems = [...editingOrder.items];
                                newItems[idx].total_price = parseFloat(e.target.value);
                                setEditingOrder({...editingOrder, items: newItems});
                              }}
                              className="px-2 py-1 bg-gray-600 border border-gray-500 text-white rounded text-xs sm:text-sm"
                              placeholder="Total"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end mt-4 sm:mt-6">
                  <button
                    type="button"
                    onClick={() => setEditingOrder(null)}
                    className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors text-sm sm:text-base order-2 sm:order-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base order-1 sm:order-2"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Order Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setShowAddModal(false)}>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-6 max-w-2xl w-full my-4 sm:my-8" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Add New Order</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const newOrder: Omit<Order, 'id' | 'created_at'> = {
                  seller: formData.get('seller') as string,
                  date: formData.get('date') as string,
                  status: formData.get('status') as string,
                  delivery_cost: parseFloat(formData.get('delivery_cost') as string),
                  total: parseFloat(formData.get('total') as string),
                  items: [{
                    product: formData.get('product') as string,
                    quantity: parseInt(formData.get('quantity') as string),
                    unit_price: parseFloat(formData.get('unit_price') as string),
                    total_price: parseFloat(formData.get('item_total') as string),
                  }]
                };
                handleAddOrder(newOrder);
              }}>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">Seller</label>
                    <input
                      type="text"
                      name="seller"
                      placeholder="Seller name"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">Date</label>
                    <input
                      type="text"
                      name="date"
                      placeholder="Jan 27, 2026, 11:45 AM"
                      defaultValue={new Date().toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">Status</label>
                    <select
                      name="status"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                      required
                    >
                      <option value="In preparation">In preparation</option>
                      <option value="In transit">In transit</option>
                      <option value="Picked up">Picked up</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="border-t border-gray-700 pt-3 sm:pt-4">
                    <h4 className="text-xs sm:text-sm font-medium text-gray-300 mb-2 sm:mb-3">Item Details</h4>

                    <div className="space-y-2 sm:space-y-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Product Name</label>
                        <input
                          type="text"
                          name="product"
                          placeholder="Product name"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Quantity</label>
                          <input
                            type="number"
                            name="quantity"
                            placeholder="1"
                            min="1"
                            defaultValue="1"
                            className="w-full px-2 sm:px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Unit Price</label>
                          <input
                            type="number"
                            name="unit_price"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            className="w-full px-2 sm:px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Item Total</label>
                          <input
                            type="number"
                            name="item_total"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            className="w-full px-2 sm:px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2 sm:pt-3">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">Delivery Cost (zł)</label>
                      <input
                        type="number"
                        name="delivery_cost"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        defaultValue="0"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">Order Total (zł)</label>
                      <input
                        type="number"
                        name="total"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end mt-4 sm:mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors text-sm sm:text-base order-2 sm:order-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base order-1 sm:order-2"
                  >
                    Add Order
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
