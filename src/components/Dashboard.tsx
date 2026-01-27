import { useState, useEffect } from 'react';
import { Order } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parse, format } from 'date-fns';

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const itemsPerPage = 10;
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

      const result = await response.json();

      if (response.ok || response.status === 207) {
        setUploadMessage({
          type: 'success',
          text: `Successfully imported ${result.inserted} orders! ${result.failed ? `(${result.failed} failed)` : ''}`
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

      const result = await response.json();

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

      const result = await response.json();

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

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order => {
        const searchableText = [
          order.seller,
          order.date,
          order.status,
          order.total.toString(),
          ...order.items.map(item => item.product)
        ].join(' ').toLowerCase();

        return searchableText.includes(term);
      });
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
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Order Dashboard</h1>

        {/* Upload Section */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">Import Orders</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg cursor-pointer hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <span className="text-sm text-gray-400">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <div className="text-sm text-gray-400 uppercase">Total Orders</div>
            <div className="text-3xl font-bold text-blue-400">{stats.totalOrders}</div>
          </div>
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <div className="text-sm text-gray-400 uppercase">Total Spent</div>
            <div className="text-3xl font-bold text-green-400">{stats.totalSpent.toFixed(2)} zł</div>
          </div>
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <div className="text-sm text-gray-400 uppercase">Average Order</div>
            <div className="text-3xl font-bold text-purple-400">{stats.averageOrder.toFixed(2)} zł</div>
          </div>
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <div className="text-sm text-gray-400 uppercase">Free Delivery</div>
            <div className="text-3xl font-bold text-indigo-400">{stats.freeDeliveryPercent.toFixed(0)}%</div>
          </div>
        </div>

        {/* Monthly Spending Chart */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8 border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-6">Monthly Spending Trends</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={getMonthlySpending()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="month"
                angle={-45}
                textAnchor="end"
                height={80}
                stroke="#9CA3AF"
              />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                formatter={(value: number) => `${value.toFixed(2)} zł`}
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#fff' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#60A5FA"
                strokeWidth={2}
                name="Total Spending (zł)"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Orders List */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Recent Orders</h2>
            {selectedOrders.length > 0 && (
              <button
                onClick={() => setDeleteConfirm('bulk')}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete {selectedOrders.length} Selected
              </button>
            )}
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by seller, product, date, status..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="w-full md:w-48">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="In preparation">In Preparation</option>
                <option value="In transit">In Transit</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
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

          <div className="space-y-4">
            {getPaginatedOrders().map((order, index) => (
              <div key={index} className={`border rounded-lg p-4 transition-all ${
                selectedOrders.includes(order.id || '')
                  ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                  : 'border-gray-700 bg-gray-750 hover:border-gray-600'
              }`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.id || '')}
                      onChange={() => toggleOrderSelection(order.id || '')}
                      className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                    />
                    <div className="flex-1">
                      <div className="text-lg font-semibold text-white">{order.seller}</div>
                      <div className="text-sm text-gray-400">{order.date}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-400">{order.total.toFixed(2)} zł</div>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        order.status === 'Delivered' ? 'bg-green-900 text-green-300 border border-green-700' :
                        order.status === 'In transit' ? 'bg-blue-900 text-blue-300 border border-blue-700' :
                        'bg-yellow-900 text-yellow-300 border border-yellow-700'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingOrder(order)}
                        className="p-2 text-blue-400 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Edit order"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(order.id || '')}
                        className="p-2 text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Delete order"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {order.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex justify-between text-sm bg-gray-700 p-2 rounded">
                      <span className="text-gray-200">{item.product}</span>
                      <span className="text-gray-300">
                        {item.quantity} x {item.unit_price} zł = {item.total_price.toFixed(2)} zł
                      </span>
                    </div>
                  ))}
                </div>

                {order.delivery_cost > 0 && (
                  <div className="text-sm text-gray-400 mt-2">
                    Delivery Cost: {order.delivery_cost.toFixed(2)} zł
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {getTotalPages() > 1 && (
            <div className="mt-6 pt-6 border-t border-gray-700">
              <div className="flex items-center justify-center gap-2 mb-3">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <div className="flex gap-1">
                  {getPageNumbers().map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-400">
                        ...
                      </span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page as number)}
                        className={`px-3 py-2 rounded-lg transition-colors min-w-[40px] ${
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
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
              <div className="text-center text-sm text-gray-400">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, getFilteredAndSortedOrders().length)} of {getFilteredAndSortedOrders().length} orders
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-white mb-4">Confirm Delete</h3>
              <p className="text-gray-300 mb-6">
                {deleteConfirm === 'bulk'
                  ? `Are you sure you want to delete ${selectedOrders.length} selected order(s)? This action cannot be undone.`
                  : 'Are you sure you want to delete this order? This action cannot be undone.'}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteConfirm === 'bulk' ? handleBulkDelete() : handleDelete(deleteConfirm)}
                  className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete {deleteConfirm === 'bulk' ? `${selectedOrders.length}` : ''}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Order Modal */}
        {editingOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setEditingOrder(null)}>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-2xl w-full my-8" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-white mb-4">Edit Order</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleUpdate(editingOrder);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Seller</label>
                    <input
                      type="text"
                      value={editingOrder.seller}
                      onChange={(e) => setEditingOrder({...editingOrder, seller: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Date</label>
                    <input
                      type="text"
                      value={editingOrder.date}
                      onChange={(e) => setEditingOrder({...editingOrder, date: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                    <select
                      value={editingOrder.status}
                      onChange={(e) => setEditingOrder({...editingOrder, status: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="In preparation">In preparation</option>
                      <option value="In transit">In transit</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Delivery Cost (zł)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingOrder.delivery_cost}
                        onChange={(e) => setEditingOrder({...editingOrder, delivery_cost: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Total (zł)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingOrder.total}
                        onChange={(e) => setEditingOrder({...editingOrder, total: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Items</label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {editingOrder.items.map((item, idx) => (
                        <div key={idx} className="bg-gray-700 p-3 rounded-lg border border-gray-600">
                          <input
                            type="text"
                            value={item.product}
                            onChange={(e) => {
                              const newItems = [...editingOrder.items];
                              newItems[idx].product = e.target.value;
                              setEditingOrder({...editingOrder, items: newItems});
                            }}
                            className="w-full px-2 py-1 mb-2 bg-gray-600 border border-gray-500 text-white rounded text-sm"
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
                              className="px-2 py-1 bg-gray-600 border border-gray-500 text-white rounded text-sm"
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
                              className="px-2 py-1 bg-gray-600 border border-gray-500 text-white rounded text-sm"
                              placeholder="Price (zł)"
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
                              className="px-2 py-1 bg-gray-600 border border-gray-500 text-white rounded text-sm"
                              placeholder="Total (zł)"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end mt-6">
                  <button
                    type="button"
                    onClick={() => setEditingOrder(null)}
                    className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save Changes
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
