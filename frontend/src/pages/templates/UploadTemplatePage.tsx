import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, AlertCircle, X, Layers, ChevronDown, ChevronUp, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { templatesApi, categoriesApi } from '../../lib/api';

const FIELD_TYPES = ['text', 'email', 'phone', 'date', 'number', 'textarea'];
const GROUP_SUGGESTIONS = ['Client Information', 'Contract Terms', 'Payment', 'General', 'Legal'];

export default function UploadTemplatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'configure'>('upload');

  const { data: categoriesData } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const categories = categoriesData?.data || [];

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('file', file!);
      if (name) fd.append('name', name);
      if (categoryId) fd.append('category_id', categoryId);
      return templatesApi.upload(fd);
    },
    onSuccess: (res) => {
      setUploadResult(res.data);
      setName(name || file?.name.replace('.docx', '') || 'New Template');
      const detectedFields = res.data.detected_fields || [];
      setFields(detectedFields.map((f: any, i: number) => ({
        ...f,
        id: `field_${i}`,
        required: true,
        optional: false,
        default_value: '',
        description: '',
        group_name: 'General',
        order_index: i,
      })));
      setStep('configure');
      if (res.data.warning) toast(res.data.warning, { icon: '⚠️' });
      else toast.success(`${detectedFields.length} fields detected!`);
    },
    onError: (err: any) => toast.error(err.response?.data?.details || 'Upload failed'),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const id = uploadResult.template.id;
      return templatesApi.updateFields(id, fields.map((f, i) => ({
        id: f.id,
        label: f.label,
        field_type: f.field_type || f.fieldType,
        required: f.required,
        optional: f.optional,
        default_value: f.default_value,
        description: f.description,
        group_name: f.group_name,
        order_index: i,
      })));
    },
    onSuccess: () => {
      toast.success('Template saved successfully!');
      qc.invalidateQueries({ queryKey: ['templates'] });
      navigate('/templates');
    },
    onError: () => toast.error('Failed to save template'),
  });

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0]);
      if (!name) setName(accepted[0].name.replace('.docx', '').replace(/_/g, ' '));
    }
  }, [name]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }, maxFiles: 1,
  });

  const updateField = (id: string, key: string, value: any) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  if (step === 'configure') {
    return (
      <div className="animate-fade-in max-w-3xl">
        <div className="page-header">
          <div>
            <h1 className="page-title">Configure Template</h1>
            <p className="page-subtitle">{fields.length} field{fields.length !== 1 ? 's' : ''} detected from yellow highlights</p>
          </div>
        </div>

        {fields.length === 0 ? (
          <div className="card p-8 text-center mb-6">
            <AlertCircle size={36} className="mx-auto text-yellow-500 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">No yellow fields detected</h3>
            <p className="text-sm text-gray-500">Make sure text in your DOCX is highlighted with yellow (wdYellow) in Microsoft Word.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {fields.map((f, i) => (
              <div key={f.id} className="card overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedField(expandedField === f.id ? null : f.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-navy-100 text-navy-700 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                    <div>
                      <span className="font-medium text-gray-900 text-sm">{f.label}</span>
                      <span className="ml-2 text-xs text-gray-400">{f.fieldKey || f.field_key}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded capitalize">{f.field_type || f.fieldType}</span>
                    {f.required && <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">Required</span>}
                    {expandedField === f.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                </div>

                {expandedField === f.id && (
                  <div className="border-t border-gray-100 p-4 grid grid-cols-2 gap-3 animate-fade-in">
                    <div>
                      <label className="form-label">Field Label</label>
                      <input type="text" className="form-input" value={f.label} onChange={(e) => updateField(f.id, 'label', e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Type</label>
                      <select className="form-input" value={f.field_type || f.fieldType} onChange={(e) => updateField(f.id, 'field_type', e.target.value)}>
                        {FIELD_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Group</label>
                      <input list="groups" type="text" className="form-input" value={f.group_name} onChange={(e) => updateField(f.id, 'group_name', e.target.value)} />
                      <datalist id="groups">{GROUP_SUGGESTIONS.map(g => <option key={g} value={g} />)}</datalist>
                    </div>
                    <div>
                      <label className="form-label">Default Value</label>
                      <input type="text" className="form-input" value={f.default_value} onChange={(e) => updateField(f.id, 'default_value', e.target.value)} placeholder="Optional" />
                    </div>
                    <div className="col-span-2">
                      <label className="form-label">Helper Text</label>
                      <input type="text" className="form-input" value={f.description} onChange={(e) => updateField(f.id, 'description', e.target.value)} placeholder="Displayed to user as hint" />
                    </div>
                    <div className="col-span-2 flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={f.required} onChange={(e) => updateField(f.id, 'required', e.target.checked)} className="rounded" />
                        <span className="text-sm text-gray-700">Required</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={f.optional} onChange={(e) => updateField(f.id, 'optional', e.target.checked)} className="rounded" />
                        <span className="text-sm text-gray-700">Optional</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => { setStep('upload'); setUploadResult(null); }} className="btn-secondary">
            ← Back
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="btn-primary flex-1 justify-center"
            id="save-template-btn"
          >
            {saveMutation.isPending ? <><div className="w-4 h-4 border-2 border-navy-900/30 border-t-navy-900 rounded-full animate-spin" />Saving...</> : <><Save size={15} />Save Template</>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload Template</h1>
          <p className="page-subtitle">Upload a DOCX file with yellow-highlighted fields</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-gold-50 border border-gold-200 rounded-xl mb-5 text-sm text-gold-800">
        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
        <div>
          <strong>How it works:</strong> Highlight any text you want to become an input field with <strong>yellow background</strong> in Microsoft Word (Format → Text Highlight Color → Yellow), then upload here.
        </div>
      </div>

      <div className="card p-6 space-y-5">
        {/* Template name */}
        <div>
          <label className="form-label">Template Name</label>
          <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Service Agreement" />
        </div>

        {/* Category */}
        <div>
          <label className="form-label">Category</label>
          <select className="form-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— No category —</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Drop zone */}
        <div>
          <label className="form-label">DOCX File</label>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200
              ${isDragActive ? 'border-gold-400 bg-gold-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
            id="dropzone"
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText size={24} className="text-green-600" />
                <div className="text-left">
                  <div className="font-medium text-green-800">{file.name}</div>
                  <div className="text-xs text-green-600">{(file.size / 1024).toFixed(0)} KB · Click to change</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="ml-2 text-gray-400 hover:text-red-500">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div>
                <Upload size={32} className={`mx-auto mb-2 ${isDragActive ? 'text-gold-500' : 'text-gray-300'}`} />
                <p className="text-sm font-medium text-gray-600">
                  {isDragActive ? 'Drop it here!' : 'Drag & drop your DOCX file here'}
                </p>
                <p className="text-xs text-gray-400 mt-1">or click to browse · .docx only · max 50MB</p>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => uploadMutation.mutate()}
          disabled={!file || uploadMutation.isPending}
          className="btn-primary w-full justify-center py-3"
          id="analyze-template-btn"
        >
          {uploadMutation.isPending
            ? <><div className="w-4 h-4 border-2 border-navy-900/30 border-t-navy-900 rounded-full animate-spin" />Analyzing...</>
            : <><Layers size={15} />Analyze & Detect Fields</>
          }
        </button>
      </div>
    </div>
  );
}
