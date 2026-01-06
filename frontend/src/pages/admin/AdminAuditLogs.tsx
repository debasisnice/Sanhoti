import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Calendar, User, Activity, Search, Eye, X } from 'lucide-react';
import { auditAPI, usersAPI } from '../../services/api';
import { AuditLog, User as UserType } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { convertPSTToLocal } from '../../utils/dateUtils';

export default function AdminAuditLogs() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterResource, setFilterResource] = useState<string>('');
  const [selectedLogDetails, setSelectedLogDetails] = useState<AuditLog | null>(null);

  useEffect(() => {
    fetchAuditLogs();
    fetchUsers();
  }, []);

  useEffect(() => {
    // Create a map of userId to user name
    // Note: The audit log userId matches the user.id (which is transformed from user_id)
    const nameMap: Record<string, string> = {};
    users.forEach(user => {
      const fullName = `${user.firstName} ${user.lastName}`.trim();
      // Map both id and userId (in case of any inconsistencies)
      if (user.id) {
        nameMap[user.id] = fullName || user.email;
      }
      // Also check if there's a userId property
      if ((user as any).userId) {
        nameMap[(user as any).userId] = fullName || user.email;
      }
    });
    setUserNameMap(nameMap);
  }, [users]);

  const fetchUsers = async () => {
    try {
      const userList = await usersAPI.getAll();
      setUsers(userList);
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const logs = await auditAPI.getAll();
      // Sort by timestamp descending (newest first)
      const sortedLogs = logs.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setAuditLogs(sortedLogs);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  // Get unique actions and resources for filters
  const uniqueActions = [...new Set(auditLogs.map(log => log.action))].sort();
  const uniqueResources = [...new Set(auditLogs.map(log => log.resource))].sort();

  // Filter logs
  const filteredLogs = auditLogs.filter(log => {
    const detailsString = log.details 
      ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details))
      : '';
    
    const matchesSearch = 
      !searchTerm ||
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.resourceId && log.resourceId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      detailsString.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = !filterAction || log.action === filterAction;
    const matchesResource = !filterResource || log.resource === filterResource;

    return matchesSearch && matchesAction && matchesResource;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Audit Logs</h1>
          <p className="text-gray-600">View all system activity and changes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by user, action, resource..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Action
            </label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Actions</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Resource
            </label>
            <select
              value={filterResource}
              onChange={(e) => setFilterResource(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Resources</option>
              {uniqueResources.map(resource => (
                <option key={resource} value={resource}>{resource}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No audit logs found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Timestamp</th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">User</th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Action</th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Resource</th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Resource ID</th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Details</th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {format(convertPSTToLocal(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {userNameMap[log.userId] || log.userEmail || log.userId}
                          </p>
                          <p className="text-xs text-gray-500">{log.userEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        log.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                        log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                        log.action === 'UPLOAD' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{log.resource}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600 font-mono">
                        {log.resourceId || '-'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600 line-clamp-2">
                        {log.details ? (
                          typeof log.details === 'string' 
                            ? (log.details.length > 100 ? `${log.details.substring(0, 100)}...` : log.details)
                            : JSON.stringify(log.details).length > 100 
                              ? `${JSON.stringify(log.details).substring(0, 100)}...` 
                              : JSON.stringify(log.details)
                        ) : '-'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600 font-mono">
                        {log.ipAddress || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing {filteredLogs.length} of {auditLogs.length} audit logs
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

