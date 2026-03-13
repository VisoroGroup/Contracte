import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, ChevronDown, ChevronUp, Upload, History, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import { templatesApi, categoriesApi } from '../../lib/api';
import { format } from 'date-fns';

const FIELD_TYPES = ['text', 'email', 'phone', 'date', 'number', 'textarea'];

export default function EditTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['template', id], queryFn: () => templatesApi.get(id!) });
  const { data: catData } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const { data: versionsData } = useQuery({ queryKey: ['template-versions', id], queryFn: () => templatesApi.getVersions(id!) });

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [fields, setFields] = useState<any[]>([]);

  React.useEffect(() => {
    if (data?.data) {
      setName(data.data.name);
      setCategoryId(data.data.category_id || '');
      setFields(data.data.fields || []);
    }
  }, [data]);

  const updateMeta = useMutation({
    mutationFn: () => templatesApi.update(id!, { name, category_id: categoryId }),
    onSuccess: () => { toast.success('Template updated'); qc.invalidateQueries({ queryKey: ['templates'] }); },
  });

  const updateFields = useMutation({
    mutationFn: () => templatesApi.updateFields(id!, fields),
    onSuccess: () => { toast.success('Fields saved'); qc.invalidateQueries({ queryKey: ['template', id] }); },
  });

  const saveAll = async () => {
    await updateMeta.mutateAsync();
    await updateFields.mutateAsync();
  };

  const uploadVersion = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData(); fd.append('file', file);
      return templatesApi.uploadVersion(id!, fd);
    },
    onSuccess: () => {
      toast.success('New version uploaded'); qc.invalidateQueries({ queryKey: ['template', id] });
      qc.invalidateQueries({ queryKey: ['template-versions', id] });
    },
    onError: () => toast.error('Upload failed'),
  });

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
    maxFiles: 1,
    onDrop: ([f]) => { if (f) uploadVersion.mutate(f); },
  });

  const updateField = (fieldId: string, key: string, value: any) => {
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, [key]: value } : f));
  };

  const categories = catData?.data || [];
  const versions = versionsData?.data || [];

  if (isLoading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Edit Template</h1>
          <p className="page-subtitle">Modify fields and upload new versions</p>
        </div>
        <button onClick={saveAll} disabled={updateMeta.isPending || updateFields.isPending} className="btn-primary">
          <Save size={15} /> Save All Changes
        </button>
      </div>

      {/* Meta */}
      <div className="card p-5 mb-4 grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Template Name</label>
          <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Category</label>
          <select className="form-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— No category —</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Upload new version */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Upload New Version</h2>
          <button onClick={() => setShowVersions(!showVersions)} className="text-sm text-gold-600 flex items-center gap-1">
            <History size={13} /> History ({versions.length})
          </button>
        </div>
        <div {...getRootProps()} className="border-2 border-dashed rounded-lg p-5 text-center cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-all">
          <input {...getInputProps()} />
          <Upload size={20} className="mx-auto mb-1 text-gray-300" />
          <p className="text-sm text-gray-500">Drop new DOCX here or click to browse</p>
        </div>
        {showVersions && versions.length > 0 && (
          <div className="mt-3 divide-y divide-gray-50">
            {versions.map((v: any) => (
              <div key={v.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-gray-700">Version {v.version_number}</span>
                <span className="text-gray-400">{format(new Date(v.uploaded_at), 'MMM d, yyyy HH:mm')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fields */}
      <div className="space-y-2">
        <h2 className="font-semibold text-gray-900 mb-2">Fields ({fields.length})</h2>
        {fields.map((f, i) => (
          <div key={f.id} className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedField(expandedField === f.id ? null : f.id)}>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-navy-100 text-navy-700 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                <span className="font-medium text-sm text-gray-900">{f.label}</span>
                <span className="text-xs text-gray-400">{f.field_key}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded capitalize">{f.field_type}</span>
                {expandedField === f.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </div>
            {expandedField === f.id && (
              <div className="border-t border-gray-100 p-4 grid grid-cols-2 gap-3 animate-fade-in">
                <div><label className="form-label">Label</label><input type="text" className="form-input" value={f.label} onChange={e => updateField(f.id, 'label', e.target.value)} /></div>
                <div><label className="form-label">Type</label>
                  <select className="form-input" value={f.field_type} onChange={e => updateField(f.id, 'field_type', e.target.value)}>
                    {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Group</label><input type="text" className="form-input" value={f.group_name || ''} onChange={e => updateField(f.id, 'group_name', e.target.value)} /></div>
                <div><label className="form-label">Default Value</label><input type="text" className="form-input" value={f.default_value || ''} onChange={e => updateField(f.id, 'default_value', e.target.value)} /></div>
                <div className="col-span-2"><label className="form-label">Helper Text</label><input type="text" className="form-input" value={f.description || ''} onChange={e => updateField(f.id, 'description', e.target.value)} /></div>
                <div className="col-span-2 flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={f.required} onChange={e => updateField(f.id, 'required', e.target.checked)} /> Required</label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={f.optional} onChange={e => updateField(f.id, 'optional', e.target.checked)} /> Optional</label>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
