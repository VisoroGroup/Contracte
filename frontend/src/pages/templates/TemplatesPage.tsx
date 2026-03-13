import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Plus, Search, Filter, Edit2, Copy, Archive, Eye,
  Calendar, Tag, Layers, MoreVertical, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { templatesApi, categoriesApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';

export default function TemplatesPage() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('newest');
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['templates', search, category, sort],
    queryFn: () => templatesApi.list({ search, category, sort }),
  });

  const { data: categoriesData } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => templatesApi.archive(id),
    onSuccess: () => { toast.success('Template archived'); qc.invalidateQueries({ queryKey: ['templates'] }); },
    onError: () => toast.error('Failed to archive'),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => templatesApi.duplicate(id),
    onSuccess: () => { toast.success('Template duplicated'); qc.invalidateQueries({ queryKey: ['templates'] }); },
    onError: () => toast.error('Failed to duplicate'),
  });

  const templates = data?.data || [];
  const categories = categoriesData?.data || [];

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Templates</h1>
          <p className="page-subtitle">{templates.length} template{templates.length !== 1 ? 's' : ''} available</p>
        </div>
        {isAdmin && (
          <Link to="/templates/upload" className="btn-primary" id="upload-template-btn">
            <Plus size={16} /> Upload Template
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-9 py-2"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="form-input py-2 pr-8 min-w-40"
        >
          <option value="">All Categories</option>
          {categories.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="form-input py-2 pr-8 min-w-44"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="most_used">Most Used</option>
          <option value="alphabetical">Alphabetical</option>
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-lg mb-3" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="card p-16 text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No templates found</h3>
          <p className="text-gray-400 text-sm mb-4">
            {search || category ? 'Try adjusting your filters.' : 'Get started by uploading your first DOCX template.'}
          </p>
          {isAdmin && (
            <Link to="/templates/upload" className="btn-primary inline-flex">
              <Plus size={15} /> Upload Template
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map((t: any) => (
            <div key={t.id} className="card p-5 hover:shadow-md transition-all duration-200 group relative">
              {/* Icon */}
              <div className="w-10 h-10 bg-navy-50 rounded-lg flex items-center justify-center mb-3">
                <FileText size={20} className="text-navy-700" />
              </div>

              {/* Name */}
              <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1 group-hover:text-navy-800 transition-colors">
                {t.name}
              </h3>

              {/* Category */}
              {t.category_name && (
                <span className="inline-flex items-center gap-1 text-xs text-gold-700 bg-gold-50 px-2 py-0.5 rounded-full mb-2">
                  <Tag size={10} /> {t.category_name}
                </span>
              )}

              {/* Meta */}
              <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                <span className="flex items-center gap-1"><Layers size={11} /> {t.field_count} fields</span>
                <span className="flex items-center gap-1"><Calendar size={11} /> {format(new Date(t.created_at), 'MMM d, yyyy')}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Link
                  to={`/contracts/new?template=${t.id}`}
                  className="flex-1 btn-primary text-xs py-1.5 justify-center"
                  id={`use-template-${t.id}`}
                >
                  Use Template
                </Link>
                {isAdmin && (
                  <div className="relative">
                    <button
                      onClick={() => setShowMenu(showMenu === t.id ? null : t.id)}
                      className="btn-ghost p-2 text-gray-400"
                    >
                      <MoreVertical size={15} />
                    </button>
                    {showMenu === t.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 animate-fade-in">
                        <Link
                          to={`/templates/${t.id}/edit`}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setShowMenu(null)}
                        >
                          <Edit2 size={13} /> Edit
                        </Link>
                        <button
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                          onClick={() => { duplicateMutation.mutate(t.id); setShowMenu(null); }}
                        >
                          <Copy size={13} /> Duplicate
                        </button>
                        <button
                          className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                          onClick={() => { if (confirm(`Archive "${t.name}"?`)) { archiveMutation.mutate(t.id); setShowMenu(null); } }}
                        >
                          <Archive size={13} /> Archive
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
