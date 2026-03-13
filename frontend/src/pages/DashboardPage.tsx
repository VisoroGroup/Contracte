import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, FileCheck, FilePlus, TrendingUp, Clock, CheckCircle, Send, Archive, AlertCircle } from 'lucide-react';
import { contractsApi, templatesApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  draft: 'badge-draft',
  generated: 'badge-generated',
  sent: 'badge-sent',
  signed: 'badge-signed',
  archived: 'badge-archived',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <Clock size={14} />,
  generated: <FileCheck size={14} />,
  sent: <Send size={14} />,
  signed: <CheckCircle size={14} />,
  archived: <Archive size={14} />,
};

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { data: contractsData } = useQuery({ queryKey: ['contracts'], queryFn: () => contractsApi.list() });
  const { data: templatesData } = useQuery({ queryKey: ['templates'], queryFn: () => templatesApi.list() });

  const contracts = contractsData?.data || [];
  const templates = templatesData?.data || [];

  const statusCounts = contracts.reduce((acc: Record<string, number>, c: any) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  const recent = contracts.slice(0, 5);

  const StatCard = ({ icon, label, value, color, sublabel }: any) => (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
        {sublabel && <div className="text-xs text-gray-400 mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.name}!</p>
        </div>
        <Link to="/contracts/new" className="btn-primary">
          <FilePlus size={16} />
          New Contract
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<FileCheck size={22} className="text-blue-600" />}
          color="bg-blue-50"
          label="Total Contracts"
          value={contracts.length}
        />
        <StatCard
          icon={<Clock size={22} className="text-yellow-600" />}
          color="bg-yellow-50"
          label="Draft"
          value={statusCounts.draft || 0}
        />
        <StatCard
          icon={<Send size={22} className="text-purple-600" />}
          color="bg-purple-50"
          label="Sent"
          value={statusCounts.sent || 0}
        />
        <StatCard
          icon={<CheckCircle size={22} className="text-green-600" />}
          color="bg-green-50"
          label="Signed"
          value={statusCounts.signed || 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent contracts */}
        <div className="lg:col-span-2 card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Recent Contracts</h2>
            <Link to="/contracts" className="text-sm text-gold-600 hover:text-gold-700 font-medium">View all →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.length === 0 ? (
              <div className="px-6 py-10 text-center text-gray-400">
                <FileCheck size={36} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No contracts yet. <Link to="/contracts/new" className="text-gold-600 hover:underline">Create your first one.</Link></p>
              </div>
            ) : recent.map((c: any) => (
              <Link key={c.id} to={`/contracts/${c.id}`} className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors group">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-navy-800">{c.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{c.template_name} · v{c.version_number}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`${STATUS_COLORS[c.status]} flex items-center gap-1`}>
                    {STATUS_ICONS[c.status]}
                    {c.status}
                  </span>
                  <span className="text-xs text-gray-400">{format(new Date(c.updated_at), 'MMM d')}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick actions + Templates */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <Link to="/contracts/new" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                <div className="w-8 h-8 bg-gold-100 rounded-lg flex items-center justify-center text-gold-600 group-hover:bg-gold-200 transition-colors">
                  <FilePlus size={15} />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">New Contract</div>
                  <div className="text-xs text-gray-400">Fill in a template form</div>
                </div>
              </Link>
              {isAdmin && (
                <Link to="/templates/upload" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 group-hover:bg-blue-200 transition-colors">
                    <FileText size={15} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">Upload Template</div>
                    <div className="text-xs text-gray-400">Add a DOCX template</div>
                  </div>
                </Link>
              )}
            </div>
          </div>

          {/* Status breakdown */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Status Breakdown</h2>
            <div className="space-y-2">
              {['draft', 'generated', 'sent', 'signed', 'archived'].map((s) => (
                <div key={s} className="flex items-center justify-between">
                  <span className={`${STATUS_COLORS[s]} capitalize`}>{s}</span>
                  <span className="text-sm font-semibold text-gray-700">{statusCounts[s] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Templates */}
          {isAdmin && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">Templates</h2>
                <Link to="/templates" className="text-sm text-gold-600">View all →</Link>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-0.5">{templates.length}</div>
              <div className="text-sm text-gray-500">Active templates</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
