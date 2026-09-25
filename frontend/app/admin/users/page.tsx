'use client';

import React, { useEffect, useState } from 'react';
import { fetchAdminUsers, updateAdminUserRole, type AdminUsersResponse } from '@/lib/admin-api';
import type { AuthUser } from '@/types/auth';

export default function AdminUsersPage() {
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Role Edit State
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [newRole, setNewRole] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [page]);

  async function loadUsers() {
    try {
      setLoading(true);
      const res = await fetchAdminUsers({ page });
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    try {
      setSaving(true);
      await updateAdminUserRole(editingUser.id, newRole);
      setEditingUser(null);
      await loadUsers(); // Refresh
    } catch (err: any) {
      alert(err.message || 'Failed to update user role.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Users Management</h1>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[12px] uppercase text-slate-500 font-semibold tracking-wider">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[14px]">
              {loading && !data ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : data?.users.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                data?.users.data.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 font-mono">{user.id}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{user.name}</td>
                    <td className="px-6 py-4 text-slate-600">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                        user.role === 'super-admin' ? 'bg-amber-100 text-amber-800' :
                        user.role === 'organizer' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {user.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(user.created_at || '').toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setNewRole(user.role);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold text-[13px] hover:underline"
                      >
                        Change Role
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.users.last_page > 1 && (
          <div className="p-4 border-t border-slate-200 flex justify-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded-lg border border-slate-300 text-slate-700 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-3 py-1 text-slate-600">
              Page {page} of {data.users.last_page}
            </span>
            <button
              disabled={page === data.users.last_page}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded-lg border border-slate-300 text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Role Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Change User Role</h2>
            <p className="text-sm text-slate-600 mb-4">
              Update role for <strong>{editingUser.name}</strong> ({editingUser.email})
            </p>
            <form onSubmit={handleRoleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Select Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="customer">Customer</option>
                  <option value="organizer">Organizer</option>
                  <option value="super-admin">Super Admin</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 font-semibold disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
