import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, Trash2, Edit2, Users, Building, Tag, Upload, X, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsApi, categoriesApi, usersApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type Tab = 'company' | 'categories' | 'users';

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('company');
  const qc = useQueryClient();

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage company info, categories, and users</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'company' as Tab, label: 'Company Info', icon: <Building size={14} /> },
          { id: 'categories' as Tab, label: 'Categories', icon: <Tag size={14} /> },
          { id: 'users' as Tab, label: 'Users', icon: <Users size={14} /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            id={`settings-tab-${t.id}`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'company' && <CompanyTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'users' && <UsersTab />}
    </div>
  );
}

function CompanyTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => { if (data?.data) setForm(data.data); }, [data]);

  const updateMutation = useMutation({
    mutationFn: () => settingsApi.update(form),
    onSuccess: () => { toast.success('Settings saved'); qc.invalidateQueries({ queryKey: ['settings'] }); },
    onError: () => toast.error('Failed to save'),
  });

  const fields = [
    { key: 'company_name', label: 'Company Name', type: 'text' },
    { key: 'company_address', label: 'Company Address', type: 'text' },
    { key: 'company_registration', label: 'Registration Number', type: 'text' },
    { key: 'company_email', label: 'Company Email', type: 'email' },
    { key: 'company_phone', label: 'Company Phone', type: 'tel' },
    { key: 'default_payment_terms', label: 'Default Payment Terms', type: 'text' },
    { key: 'default_governing_law', label: 'Default Governing Law', type: 'text' },
    { key: 'sent_reminder_days', label: 'Sent Reminder Days', type: 'number' },
  ];

  if (isLoading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="card p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map(f => (
          <div key={f.key}>
            <label className="form-label">{f.label}</label>
            <input
              type={f.type}
              className="form-input"
              value={form[f.key] || ''}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              id={`setting-${f.key}`}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="btn-primary" id="save-settings-btn">
          {updateMutation.isPending ? 'Saving...' : <><Save size={14} /> Save Settings</>}
        </button>
      </div>
    </div>
  );
}

function CategoriesTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const categories = data?.data || [];

  const createMutation = useMutation({
    mutationFn: () => categoriesApi.create(newName),
    onSuccess: () => { toast.success('Category added'); setNewName(''); qc.invalidateQueries({ queryKey: ['categories'] }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => categoriesApi.update(id, name),
    onSuccess: () => { toast.success('Updated'); setEditId(null); qc.invalidateQueries({ queryKey: ['categories'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['categories'] }); },
    onError: () => toast.error('Failed to delete'),
  });

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Add Category</h2>
        <div className="flex gap-2">
          <input
            type="text"
            className="form-input flex-1"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Web Design"
            id="new-category-input"
            onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) createMutation.mutate(); }}
          />
          <button onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending} className="btn-primary" id="add-category-btn">
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      <div className="card divide-y divide-gray-50">
        {categories.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No categories yet.</div>
        ) : categories.map((c: any) => (
          <div key={c.id} className="flex items-center justify-between px-5 py-3">
            {editId === c.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input type="text" className="form-input py-1.5 flex-1" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                <button onClick={() => updateMutation.mutate({ id: c.id, name: editName })} className="btn-primary py-1.5 text-xs">Save</button>
                <button onClick={() => setEditId(null)} className="btn-ghost py-1.5 text-xs"><X size={13} /></button>
              </div>
            ) : (
              <>
                <span className="text-sm font-medium text-gray-800">{c.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => { setEditId(c.id); setEditName(c.name); }} className="btn-ghost p-1.5 text-gray-400"><Edit2 size={13} /></button>
                  <button onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteMutation.mutate(c.id); }} className="btn-ghost p-1.5 text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'user' });
  const [showPass, setShowPass] = useState(false);
  const users = data?.data || [];

  const createMutation = useMutation({
    mutationFn: () => usersApi.create(form),
    onSuccess: () => { toast.success('User created'); setShowForm(false); setForm({ email: '', name: '', password: '', role: 'user' }); qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => { toast.success('User deactivated'); qc.invalidateQueries({ queryKey: ['users'] }); },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => usersApi.update(id, { active: true }),
    onSuccess: () => { toast.success('User reactivated'); qc.invalidateQueries({ queryKey: ['users'] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="btn-primary" id="add-user-btn">
          <Plus size={14} /> {showForm ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {showForm && (
        <div className="card p-5 animate-fade-in">
          <h2 className="font-semibold text-gray-900 mb-4">New User</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Full Name</label><input type="text" className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div className="relative"><label className="form-label">Password</label>
              <input type={showPass ? 'text' : 'password'} className="form-input pr-9" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-8 text-gray-400"><EyeOff size={14} /></button>
            </div>
            <div><label className="form-label">Role</label>
              <select className="form-input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button onClick={() => createMutation.mutate()} disabled={!form.email || !form.password || !form.name || createMutation.isPending} className="btn-primary mt-4" id="create-user-btn">
            <Plus size={14} /> Create User
          </button>
        </div>
      )}

      <div className="card divide-y divide-gray-50">
        {users.map((u: any) => (
          <div key={u.id} className={`flex items-center justify-between px-5 py-3.5 ${!u.active ? 'opacity-50' : ''}`}>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-navy-100 rounded-full flex items-center justify-center text-navy-700 text-xs font-bold">{u.name.charAt(0)}</div>
                <div>
                  <div className="text-sm font-medium text-gray-800">{u.name}</div>
                  <div className="text-xs text-gray-400">{u.email}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-gold-100 text-gold-700' : 'bg-gray-100 text-gray-600'} capitalize`}>{u.role}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${u.active ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'}`}>{u.active ? 'Active' : 'Inactive'}</span>
              {u.active ? (
                <button onClick={() => { if (confirm(`Deactivate ${u.name}?`)) deactivateMutation.mutate(u.id); }} className="btn-ghost p-1.5 text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
              ) : (
                <button onClick={() => reactivateMutation.mutate(u.id)} className="btn-ghost p-1.5 text-green-500 hover:text-green-700"><RefreshCw size={13} /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RefreshCw(props: any) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>;
}
