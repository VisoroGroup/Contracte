import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight, ChevronLeft, FileText, Tag, Layers, Check,
  AlertCircle, DownloadCloud, Save, Eye, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { templatesApi, contractsApi } from '../../lib/api';

const STEPS = ['Select Template', 'Fill Details', 'Review & Generate'];

type FieldValues = Record<string, string>;

function FieldInput({ field, value, onChange }: { field: any; value: string; onChange: (v: string) => void }) {
  const common = { className: `form-input ${!value && field.required ? 'border-red-300 focus:ring-red-400' : ''}`, value: value || '', onChange: (e: any) => onChange(e.target.value), id: `field-${field.field_key?.replace(/[\[\]]/g, '') || field.fieldKey}`, placeholder: field.default_value || field.description || `Enter ${field.label.toLowerCase()}...` };
  if (field.field_type === 'textarea') return <textarea {...common} rows={3} className={common.className + ' resize-none'} />;
  return <input type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : 'text'} {...common} />;
}

function LivePreview({ template, fieldValues }: { template: any; fieldValues: FieldValues }) {
  const fields = template?.fields || [];
  const renderText = (text: string) => {
    let result = text;
    for (const f of fields) {
      const key = f.field_key;
      const val = fieldValues[key];
      const escaped = key.replace(/[[\]]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'g'), val
        ? `<span class="yellow-field-filled font-medium">${val}</span>`
        : `<span class="yellow-field-empty">[${f.label}]</span>`);
    }
    return result;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8 font-serif text-sm text-gray-800 shadow-inner min-h-64 leading-relaxed">
      <h2 className="text-lg font-bold text-center mb-4">SERVICE AGREEMENT</h2>
      <p className="mb-3">This Service Agreement is entered into as of{' '}
        {fieldValues['[CONTRACT START DATE]'] ? <span className="yellow-field-filled">{fieldValues['[CONTRACT START DATE]']}</span> : <span className="yellow-field-empty">[Contract Start Date]</span>}
        {' '}between:
      </p>
      {fields.filter((f: any) => f.group_name === 'Client Information').map((f: any) => (
        <p key={f.id} className="mb-1">
          <strong>{f.label}: </strong>
          {fieldValues[f.field_key]
            ? <span className="yellow-field-filled">{fieldValues[f.field_key]}</span>
            : <span className="yellow-field-empty">[{f.label}]</span>}
        </p>
      ))}
      <div className="my-4 border-t border-gray-100" />
      <p className="text-xs text-gray-400 text-center italic">Live preview — updates as you type</p>
    </div>
  );
}

export default function NewContractPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState(searchParams.get('template') || '');
  const [fieldValues, setFieldValues] = useState<FieldValues>({});
  const [savedIndicator, setSavedIndicator] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<'pdf' | 'docx' | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<{ pdf?: string; docx?: string }>({});
  const qc = useQueryClient();
  const autoSaveRef = useRef<ReturnType<typeof setInterval>>();

  const { data: templatesData } = useQuery({ queryKey: ['templates'], queryFn: () => templatesApi.list() });
  const { data: templateData } = useQuery({
    queryKey: ['template', selectedTemplateId],
    queryFn: () => templatesApi.get(selectedTemplateId),
    enabled: !!selectedTemplateId,
  });

  const template = templateData?.data;
  const templates = templatesData?.data || [];

  // Pre-fill defaults
  useEffect(() => {
    if (template?.fields) {
      setFieldValues(prev => {
        const defaults: FieldValues = {};
        for (const f of template.fields) {
          if (f.default_value && !prev[f.field_key]) defaults[f.field_key] = f.default_value;
        }
        return { ...defaults, ...prev };
      });
    }
  }, [template]);

  // Auto-save draft every 30s
  useEffect(() => {
    if (step === 1 && template) {
      autoSaveRef.current = setInterval(async () => {
        await saveDraft(false);
        setSavedIndicator('Saved');
        setTimeout(() => setSavedIndicator(''), 3000);
      }, 30_000);
    }
    return () => clearInterval(autoSaveRef.current);
  }, [step, fieldValues, template, draftId]);

  const saveDraft = async (showToast = true) => {
    if (!template) return;
    try {
      if (draftId) {
        await contractsApi.update(draftId, { fields: fieldValues, status: 'draft' });
      } else {
        const res = await contractsApi.create({
          template_version_id: template.version_id,
          fields: fieldValues,
          status: 'draft',
        });
        setDraftId(res.data.id);
      }
      if (showToast) toast.success('Draft saved');
    } catch { if (showToast) toast.error('Failed to save draft'); }
  };

  const moveTo = (nextStep: number) => {
    if (nextStep === 1 && !selectedTemplateId) { toast.error('Please select a template'); return; }
    setStep(nextStep);
  };

  // Validation
  const missingFields = template?.fields?.filter((f: any) => f.required && !f.optional && !fieldValues[f.field_key]?.trim()) || [];
  const canGenerate = missingFields.length === 0;

  const handleGenerate = async (type: 'pdf' | 'docx') => {
    if (!canGenerate) { toast.error('Please fill all required fields'); return; }
    setGenerating(type);
    try {
      const contractId = draftId || (await (async () => {
        const res = await contractsApi.create({ template_version_id: template!.version_id, fields: fieldValues, status: 'draft' });
        setDraftId(res.data.id);
        return res.data.id;
      })());

      // Update fields
      await contractsApi.update(contractId, { fields: fieldValues });

      // Generate
      const genRes = type === 'pdf'
        ? await contractsApi.generatePdf(contractId)
        : await contractsApi.generateDocx(contractId);

      const url = contractsApi.getDownloadUrl(contractId, genRes.data.file_id);
      setGeneratedFiles(prev => ({ ...prev, [type]: url }));

      toast.success(`${type.toUpperCase()} generated!`);
      qc.invalidateQueries({ queryKey: ['contracts'] });
    } catch (err: any) {
      toast.error(err.response?.data?.details || `Failed to generate ${type.toUpperCase()}`);
    } finally {
      setGenerating(null);
    }
  };

  // Group fields by group_name
  const groupedFields = template?.fields?.reduce((acc: Record<string, any[]>, f: any) => {
    const g = f.group_name || 'General';
    if (!acc[g]) acc[g] = [];
    acc[g].push(f);
    return acc;
  }, {}) || {};

  return (
    <div className="animate-fade-in">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`step-indicator ${i < step ? 'text-green-700' : i === step ? 'text-navy-800' : 'text-gray-400'}`}>
              <div className={i < step ? 'step-circle-done' : i === step ? 'step-circle-active' : 'step-circle-pending'}>
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span className="hidden sm:inline">{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? 'bg-green-300' : 'bg-gray-200'} hidden sm:block`} />}
          </React.Fragment>
        ))}
      </div>

      {/* STEP 0: Select template */}
      {step === 0 && (
        <div>
          <h1 className="page-title mb-1">Select a Template</h1>
          <p className="page-subtitle mb-5">Choose the contract type you want to generate</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {templates.filter((t: any) => !t.archived).map((t: any) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplateId(t.id)}
                className={`card p-5 text-left hover:shadow-md transition-all border-2 ${selectedTemplateId === t.id ? 'border-gold-500 bg-gold-50' : 'border-transparent'}`}
                id={`template-${t.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedTemplateId === t.id ? 'bg-gold-500' : 'bg-navy-50'}`}>
                    <FileText size={18} className={selectedTemplateId === t.id ? 'text-navy-900' : 'text-navy-600'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                    {t.category_name && <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Tag size={10} />{t.category_name}</div>}
                    <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Layers size={10} />{t.field_count} fields</div>
                  </div>
                  {selectedTemplateId === t.id && <Check size={16} className="text-gold-600 flex-shrink-0" />}
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => moveTo(1)} disabled={!selectedTemplateId} className="btn-primary" id="next-to-fill">
            Next: Fill Details <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* STEP 1: Fill form */}
      {step === 1 && template && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="page-title mb-0.5">Fill in Details</h1>
              <p className="page-subtitle">{template.name} · v{template.version_number}</p>
            </div>
            {savedIndicator && <span className="text-xs text-green-600 animate-fade-in flex items-center gap-1"><Check size={12} />{savedIndicator}</span>}
          </div>

          {/* Validation summary */}
          {missingFields.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong>Required fields missing: </strong>
                {missingFields.map((f: any) => f.label).join(', ')}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form */}
            <div className="space-y-6">
              {Object.entries(groupedFields).map(([group, gFields]: [string, any]) => (
                <div key={group} className="card p-5">
                  <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2 border-b border-gray-100 pb-2">
                    <div className="w-2 h-2 bg-gold-500 rounded-full" />{group}
                  </h3>
                  <div className="space-y-3">
                    {gFields.map((f: any) => (
                      <div key={f.id}>
                        <label className="form-label" htmlFor={`field-${(f.field_key || f.fieldKey)?.replace(/[\[\]]/g, '')}`}>
                          {f.label}
                          {f.required && !f.optional && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <FieldInput field={f} value={fieldValues[f.field_key] || ''} onChange={(v) => setFieldValues(prev => ({ ...prev, [f.field_key]: v }))} />
                        {f.description && <p className="text-xs text-gray-400 mt-1">{f.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Live preview */}
            <div className="hidden lg:block">
              <h3 className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-2"><Eye size={14} /> Live Preview</h3>
              <LivePreview template={template} fieldValues={fieldValues} />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-5">
            <button onClick={() => setStep(0)} className="btn-secondary"><ChevronLeft size={15} /> Back</button>
            <button onClick={() => saveDraft(true)} className="btn-secondary" id="save-draft-btn"><Save size={14} /> Save Draft</button>
            <button onClick={() => moveTo(2)} className="btn-primary" id="next-to-review" disabled={!canGenerate}>
              Review & Generate <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Review & generate */}
      {step === 2 && template && (
        <div className="max-w-2xl">
          <h1 className="page-title mb-1">Review & Generate</h1>
          <p className="page-subtitle mb-5">Review your contract details before generating</p>

          <div className="card p-6 mb-5">
            <h2 className="font-semibold text-gray-900 mb-4">{template.name}</h2>
            <div className="grid grid-cols-2 gap-3">
              {template.fields.map((f: any) => (
                <div key={f.id} className="text-sm">
                  <span className="text-gray-400 text-xs">{f.label}</span>
                  <div className="font-medium text-gray-800 mt-0.5 truncate">{fieldValues[f.field_key] || <span className="text-gray-300 italic">—</span>}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Generate buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleGenerate('pdf')}
              disabled={generating !== null}
              className="btn-primary flex-1 justify-center py-3"
              id="generate-pdf-btn"
            >
              {generating === 'pdf'
                ? <><div className="w-4 h-4 border-2 border-navy-900/30 border-t-navy-900 rounded-full animate-spin" />Generating PDF...</>
                : <><DownloadCloud size={16} /> Download PDF</>}
            </button>
            <button
              onClick={() => handleGenerate('docx')}
              disabled={generating !== null}
              className="btn-secondary flex-1 justify-center py-3"
              id="generate-docx-btn"
            >
              {generating === 'docx'
                ? <><div className="w-4 h-4 border-2 border-gray-500/30 border-t-gray-600 rounded-full animate-spin" />Generating DOCX...</>
                : <><DownloadCloud size={16} /> Download DOCX</>}
            </button>
          </div>

          {/* Download links */}
          {(generatedFiles.pdf || generatedFiles.docx) && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl space-y-2 animate-fade-in">
              <p className="text-sm font-semibold text-green-800 flex items-center gap-1.5"><Check size={15} /> Contract generated!</p>
              {generatedFiles.pdf && <a href={generatedFiles.pdf} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-green-700 hover:underline"><DownloadCloud size={13} /> Download PDF</a>}
              {generatedFiles.docx && <a href={generatedFiles.docx} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-green-700 hover:underline"><DownloadCloud size={13} /> Download DOCX</a>}
              <Link to="/contracts" className="flex items-center gap-2 text-sm text-navy-700 hover:underline mt-2"><FileText size={13} /> View in contracts list</Link>
            </div>
          )}

          <button onClick={() => setStep(1)} className="btn-ghost mt-4"><ChevronLeft size={15} /> Back to Form</button>
        </div>
      )}
    </div>
  );
}
