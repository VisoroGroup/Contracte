import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCheck, Search, DownloadCloud, Eye, Copy, Archive, Filter, Calendar, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { contractsApi } from '../../lib/api';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  draft: 'badge-draft', generated: 'badge-generated', sent: 'badge-sent', signed: 'badge-signed', archived: 'badge-archived'
};

export default function ContractsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', search, status],
    queryFn: () => contractsApi.list({ search, status }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => contractsApi.duplicate(id),
    onSuccess: (res) => {
      toast.success('Contract duplicated as draft');
      qc.invalidateQueries({ queryKey: ['contracts'] });
    },
    onError: () => toast.error('Failed to duplicate'),
  });

  const contracts = data?.data || [];

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contracts</h1>
          <p className="page-subtitle">{contracts.length} contract{contracts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => contractsApi.exportCsv()} className="btn-secondary" id="export-csv-btn">
            <Download size={15} /> Export CSV
          </button>
          <Link to="/contracts/new" className="btn-primary" id="new-contract-btn">
            + New Contract
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search contracts..." value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-9 py-2" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="form-input py-2 min-w-36">
          <option value="">All Statuses</option>
          {['draft', 'generated', 'sent', 'signed', 'archived'].map(s => (
            <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center"><div className="w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : contracts.length === 0 ? (
          <div className="p-16 text-center">
            <FileCheck size={48} className="mx-auto text-gray-200 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-1">No contracts found</h3>
            <p className="text-sm text-gray-400 mb-4">{search || status ? 'Try adjusting your filters.' : 'Create your first contract from a template.'}</p>
            <Link to="/contracts/new" className="btn-primary inline-flex">+ New Contract</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Contract</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Template</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Updated</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {contracts.map((c: any) => (
                  <tr key={c.id} className="table-row">
                    <td className="px-5 py-3.5">
                      <Link to={`/contracts/${c.id}`} className="font-medium text-gray-900 hover:text-navy-800 transition-colors block truncate max-w-xs">
                        {c.name}
                      </Link>
                      <span className="text-xs text-gray-400">by {c.created_by_name}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-gray-600">{c.template_name}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={STATUS_COLORS[c.status] + ' capitalize'}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell text-gray-400 text-xs">
                      {format(new Date(c.updated_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/contracts/${c.id}`} className="btn-ghost p-1.5" title="View">
                          <Eye size={15} />
                        </Link>
                        <button
                          onClick={() => { if (confirm('Duplicate this contract as a new draft?')) duplicateMutation.mutate(c.id); }}
                          className="btn-ghost p-1.5" title="Duplicate"
                        >
                          <Copy size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
