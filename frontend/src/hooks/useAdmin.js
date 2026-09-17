import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '../api/client';

const EMPTY_VENDOR = {
  companyName: '',
  city: '',
  phoneNumber: '',
  email: '',
  personOfContact: '',
  specialization: '',
  status: 'approved'
};

export function useAdmin({ token, user, applySession }) {
  const isAdmin = user?.role === 'admin';

  // Admin sign-in (separate entry point from the consumer login)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  // Console data
  const [stats, setStats] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [newVendor, setNewVendor] = useState(EMPTY_VENDOR);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const call = useCallback(async (path, { method = 'GET', body } = {}) => {
    const res = await authFetch(`/admin${path}`, { token, method, body });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }, [token]);

  const loadConsole = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const vendorQuery = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const [statsRes, vendorsRes, consumersRes, logsRes] = await Promise.all([
        call('/stats'),
        call(`/vendors${vendorQuery}`),
        call('/consumers'),
        call('/audit-logs')
      ]);

      if (statsRes.ok) setStats(statsRes.data.stats);
      if (vendorsRes.ok) setVendors(vendorsRes.data.vendors || []);
      if (consumersRes.ok) setConsumers(consumersRes.data.consumers || []);
      if (logsRes.ok) setAuditLogs(logsRes.data.logs || []);

      const failed = [statsRes, vendorsRes, consumersRes, logsRes].find(res => !res.ok);
      if (failed) setError(failed.data.message || 'Could not load part of the admin console.');
    } catch (err) {
      console.error(err);
      setError('Connection error loading the admin console.');
    } finally {
      setLoading(false);
    }
  }, [call, isAdmin, statusFilter, token]);

  useEffect(() => {
    loadConsole();
  }, [loadConsole]);

  const adminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginBusy(true);
    try {
      const res = await authFetch('/admin/login', { method: 'POST', body: loginForm });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.message || 'Admin login failed.');
        return;
      }
      applySession(data.token, data.user);
      setLoginForm({ email: '', password: '' });
    } catch (err) {
      setLoginError('Connection error during admin login.');
    } finally {
      setLoginBusy(false);
    }
  };

  const runAction = async (path, options, successFallback) => {
    setMessage('');
    setError('');
    try {
      const { ok, data } = await call(path, options);
      if (!ok) {
        setError(data.message || 'Action failed.');
        return false;
      }
      setMessage(data.message || successFallback);
      await loadConsole();
      return true;
    } catch (err) {
      console.error(err);
      setError('Connection error while running that action.');
      return false;
    }
  };

  const setVendorStatus = (vendorId, status) =>
    runAction(`/vendors/${vendorId}/status`, { method: 'PATCH', body: { status } }, 'Vendor updated.');

  const deleteVendor = (vendorId) => {
    if (!confirm('Delete this vendor listing permanently?')) return Promise.resolve(false);
    return runAction(`/vendors/${vendorId}`, { method: 'DELETE' }, 'Vendor deleted.');
  };

  const createVendor = async (e) => {
    e.preventDefault();
    const created = await runAction('/vendors', { method: 'POST', body: newVendor }, 'Vendor created.');
    if (created) setNewVendor(EMPTY_VENDOR);
  };

  const setConsumerSuspended = (consumerId, isSuspended) =>
    runAction(`/consumers/${consumerId}`, { method: 'PATCH', body: { isSuspended } }, 'Consumer updated.');

  const deleteConsumer = (consumerId) => {
    if (!confirm('Delete this consumer account?')) return Promise.resolve(false);
    return runAction(`/consumers/${consumerId}`, { method: 'DELETE' }, 'Consumer deleted.');
  };

  return {
    isAdmin,

    // Login
    loginForm,
    setLoginForm,
    loginError,
    loginBusy,
    adminLogin,

    // Console data
    stats,
    vendors,
    consumers,
    auditLogs,
    statusFilter,
    setStatusFilter,
    newVendor,
    setNewVendor,
    loading,
    message,
    error,

    // Actions
    loadConsole,
    setVendorStatus,
    deleteVendor,
    createVendor,
    setConsumerSuspended,
    deleteConsumer
  };
}

export default useAdmin;
