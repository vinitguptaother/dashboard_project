'use client';

import { useState, useEffect } from 'react';
import { 
  Bell, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Target,
  TrendingUp,
  TrendingDown,
  Activity,
  Filter,
  Search,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { useNotifications } from '../hooks/useRealTimeData';
import { useAlertsWebSocket } from '../hooks/useWebSocket';
import { AuthClient } from '../lib/apiService';

interface Alert {
  _id: string;
  symbol: string;
  condition: 'above' | 'below';
  targetValue: number;
  alertType: 'price' | 'volume' | 'change';
  message: string;
  isActive: boolean;
  status: 'active' | 'triggered' | 'acknowledged';
  createdAt: string;
  triggeredAt?: string;
  currentValue?: number;
}

const AlertsTab = () => {
  const { alerts, loading, createPriceAlert, updateAlert, deleteAlert, acknowledgeAlert, loadAlerts } = useNotifications();
  
  // WebSocket for real-time alert updates
  const { onAlertUpdate } = useAlertsWebSocket();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'triggered' | 'acknowledged'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [newAlertForm, setNewAlertForm] = useState({
    symbol: '',
    condition: 'above' as 'above' | 'below',
    targetValue: '',
    alertType: 'price' as 'price' | 'volume' | 'change',
    message: ''
  });

  const [editAlertForm, setEditAlertForm] = useState({
    condition: 'above' as 'above' | 'below',
    targetValue: '',
    message: '',
    isActive: true
  });

  const filteredAlerts = alerts.filter(alert => {
    const matchesFilter = filter === 'all' || alert.status === filter;
    const matchesSearch = alert.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.message.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleCreateAlert = async () => {
    if (newAlertForm.symbol && newAlertForm.targetValue) {
      const success = await createPriceAlert(
        newAlertForm.symbol.toUpperCase(),
        parseFloat(newAlertForm.targetValue),
        newAlertForm.condition
      );
      if (success) {
        setNewAlertForm({
          symbol: '',
          condition: 'above',
          targetValue: '',
          alertType: 'price',
          message: ''
        });
        setShowCreateModal(false);
      }
    }
  };

  const handleEditAlert = async () => {
    if (editingAlert && editAlertForm.targetValue) {
      const success = await updateAlert(editingAlert._id, {
        condition: editAlertForm.condition,
        targetValue: parseFloat(editAlertForm.targetValue),
        message: editAlertForm.message,
        isActive: editAlertForm.isActive
      });
      if (success) {
        setShowEditModal(false);
        setEditingAlert(null);
      }
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (confirm('Are you sure you want to delete this alert?')) {
      await deleteAlert(alertId);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    await acknowledgeAlert(alertId);
  };

  const handleToggleAlert = async (alert: Alert) => {
    await updateAlert(alert._id, { isActive: !alert.isActive });
  };

  const openEditModal = (alert: Alert) => {
    setEditingAlert(alert);
    setEditAlertForm({
      condition: alert.condition,
      targetValue: alert.targetValue.toString(),
      message: alert.message,
      isActive: alert.isActive
    });
    setShowEditModal(true);
  };

  // WebSocket real-time alert updates
  useEffect(() => {
    const unsubscribe = onAlertUpdate((data) => {
      // Refresh alerts when new alert is triggered
      loadAlerts();
    });

    return unsubscribe;
  }, [onAlertUpdate, loadAlerts]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50';
      case 'triggered': return 'text-red-600 bg-red-50';
      case 'acknowledged': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'triggered': return <AlertTriangle className="h-4 w-4" />;
      case 'acknowledged': return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getConditionIcon = (condition: string) => {
    switch (condition) {
      case 'above': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'below': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Target className="h-4 w-4 text-gray-600" />;
    }
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Price Alerts</h2>
          <p className="text-gray-600">Manage your stock price alerts and notifications</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Create Alert</span>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Alerts</option>
            <option value="active">Active</option>
            <option value="triggered">Triggered</option>
            <option value="acknowledged">Acknowledged</option>
          </select>
          <button
            onClick={loadAlerts}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center p-8">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts found</h3>
            <p className="text-gray-600">Create your first price alert to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredAlerts.map((alert) => (
              <div key={alert._id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getConditionIcon(alert.condition)}
                      <span className="font-semibold text-lg">{alert.symbol}</span>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(alert.status)}`}>
                      {getStatusIcon(alert.status)}
                      <span className="capitalize">{alert.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleAlert(alert)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {alert.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => openEditModal(alert)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAlert(alert._id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div className="mt-3 text-sm text-gray-600">
                  <p>{alert.message}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span>Target: ₹{alert.targetValue.toLocaleString()}</span>
                    {alert.currentValue && (
                      <span>Current: ₹{alert.currentValue.toLocaleString()}</span>
                    )}
                    <span>Type: {alert.alertType}</span>
                  </div>
                  {alert.triggeredAt && (
                    <div className="mt-2 text-xs text-gray-500">
                      Triggered: {new Date(alert.triggeredAt).toLocaleString()}
                    </div>
                  )}
                </div>

                {alert.status === 'triggered' && (
                  <div className="mt-3">
                    <button
                      onClick={() => handleAcknowledgeAlert(alert._id)}
                      className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm hover:bg-yellow-200 transition-colors"
                    >
                      Acknowledge
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Alert Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Price Alert</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Symbol</label>
                <input
                  type="text"
                  value={newAlertForm.symbol}
                  onChange={(e) => setNewAlertForm({...newAlertForm, symbol: e.target.value})}
                  placeholder="e.g., RELIANCE"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                <select
                  value={newAlertForm.condition}
                  onChange={(e) => setNewAlertForm({...newAlertForm, condition: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="above">Above</option>
                  <option value="below">Below</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Value</label>
                <input
                  type="number"
                  value={newAlertForm.targetValue}
                  onChange={(e) => setNewAlertForm({...newAlertForm, targetValue: e.target.value})}
                  placeholder="e.g., 2500"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message (Optional)</label>
                <input
                  type="text"
                  value={newAlertForm.message}
                  onChange={(e) => setNewAlertForm({...newAlertForm, message: e.target.value})}
                  placeholder="Custom message"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAlert}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Alert Modal */}
      {showEditModal && editingAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Alert - {editingAlert.symbol}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                <select
                  value={editAlertForm.condition}
                  onChange={(e) => setEditAlertForm({...editAlertForm, condition: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="above">Above</option>
                  <option value="below">Below</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Value</label>
                <input
                  type="number"
                  value={editAlertForm.targetValue}
                  onChange={(e) => setEditAlertForm({...editAlertForm, targetValue: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <input
                  type="text"
                  value={editAlertForm.message}
                  onChange={(e) => setEditAlertForm({...editAlertForm, message: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editAlertForm.isActive}
                  onChange={(e) => setEditAlertForm({...editAlertForm, isActive: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                  Active
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditAlert}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Update Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsTab;
