import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, DownloadCloud, FileCheck, Clock, Send, CheckCircle,
  Archive, StickyNote, RefreshCw, AlertCircle, Calendar, User, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { contractsApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const STATUSES = ['draft', 'generated', 'sent', 'signed', 'archived'];
const STATUS_COLORS: Record<string, string> = {
  draft: 'badge-draft', generated: 'badge-generated', sent: 'badge-sent', signed: 'badge-signed', archived: 'badge-archived'
};
const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <Clock size={13} />, generated: <FileCheck size={13} />, sent: <Send size={13} />,
  signed: <CheckCircle size={13} />, archived: <Archive size={13} />,
};

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [generating, setGenerating] = useState<'pdf' | 'docx' | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['contract', id], queryFn: () => contractsApi.get(id!) });

  React.useEffect(() => {
    if (data?.data?.notes) setNotes(data.data.notes || '');
  }, [data]);

  const contract = data?.data;

  const updateMutation = useMutation({
    mutationFn: (upd: any) => contractsApi.update(id!, upd),
    onSuccess: () => { toast.success('Updated'); qc.invalidateQueries({ queryKey: ['contract', id] }); },
  });

  const handleGenerate = async (type: 'pdf' | 'docx') => {
    setGenerating(type);
    try {
      const genRes = type === 'pdf' ? await contractsApi.generatePdf(id!) : await contractsApi.generateDocx(id!);
      const url = contractsApi.getDownloadUrl(id!, genRes.data.file_id);
      window.open(url, '_blank');
      toast.success(`${type.toUpperCase()} generated`);
      qc.invalidateQueries({ queryKey: ['contract', id] });
      qc.invalidateQueries({ queryKey: ['contracts'] });
    } catch (err: any) {
      toast.error(err.response?.data?.details || `${type.toUpperCase()} generation failed`);
    } finally {
      setGenerating(null);
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!contract) return <div className="text-center py-20 text-gray-400"><AlertCircle size={32} className="mx-auto mb-2" />Contract not found.</div>;

  const fieldValues: Record<string, string> = {};
  for (const fv of contract.field_values) fieldValues[fv.field_key] = fv.value || '';

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="flex items-center gap-3 mb-5">
        <Link to="/contracts" className="btn-ghost p-2"><ArrowLeft size={17} /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{contract.name}</h1>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
            <span className="flex items-center gap-1"><User size={11} /> {contract.created_by_name}</span>
            <span className="flex items-center gap-1"><Calendar size={11} /> {format(new Date(contract.created_at), 'MMM d, yyyy')}</span>
            <span className="flex items-center gap-1"><Layers size={11} /> {contract.template_name} v{contract.version_number}</span>
          </div>
        </div>
        <span className={`${STATUS_COLORS[contract.status]} flex items-center gap-1.5 capitalize`}>
          {STATUS_ICONS[contract.status]} {contract.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Field values */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Contract Fields</h2>
            <div className="grid grid-cols-2 gap-4">
              {contract.template_fields.map((tf: any) => (
                <div key={tf.id}>
                  <div className="text-xs text-gray-400 mb-0.5">{tf.label}</div>
                  <div className={`text-sm font-medium ${fieldValues[tf.field_key] ? 'text-gray-900' : 'text-gray-300 italic'}`}>
                    {fieldValues[tf.field_key] || '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><StickyNote size={15} />Notes</h2>
              <button onClick={() => setEditingNotes(!editingNotes)} className="text-xs text-gold-600 hover:text-gold-700">
                {editingNotes ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {editingNotes ? (
              <>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="form-input resize-none text-sm"
                  placeholder="Add a note..."
                />
                <button
                  onClick={() => { updateMutation.mutate({ notes }); setEditingNotes(false); }}
                  className="btn-primary mt-2 text-xs py-1.5"
                >
                  Save Note
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-500 italic">{notes || 'No notes added.'}</p>
            )}
          </div>
        </div>

        {/* Sidebar: Actions */}
        <div className="space-y-4">
          {/* Status */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Update Status</h3>
            <div className="space-y-1.5">
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => updateMutation.mutate({ status: s })}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm capitalize transition-colors
                    ${contract.status === s ? 'bg-gold-100 text-gold-800 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {STATUS_ICONS[s]}{s}
                  {contract.status === s && <Check size={13} className="ml-auto text-gold-600" />}
                </button>
              ))}
            </div>
          </div>

          {/* Generate */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Download Contract</h3>
            <div className="space-y-2">
              <button onClick={() => handleGenerate('pdf')} disabled={generating !== null} className="btn-primary w-full justify-center text-xs py-2" id="regenerate-pdf-btn">
                {generating === 'pdf' ? <><div className="w-3.5 h-3.5 border-2 border-navy-900/30 border-t-navy-900 rounded-full animate-spin" />Generating...</> : <><DownloadCloud size={13} /> PDF</>}
              </button>
              <button onClick={() => handleGenerate('docx')} disabled={generating !== null} className="btn-secondary w-full justify-center text-xs py-2" id="regenerate-docx-btn">
                {generating === 'docx' ? <><div className="w-3.5 h-3.5 border-2 border-gray-500/30 border-t-gray-600 rounded-full animate-spin" />Generating...</> : <><DownloadCloud size={13} /> DOCX</>}
              </button>
            </div>
          </div>

          {/* Previous files */}
          {contract.files?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Generated Files</h3>
              <div className="space-y-2">
                {contract.files.map((f: any) => (
                  <a
                    key={f.id}
                    href={contractsApi.getDownloadUrl(id!, f.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-navy-700 hover:text-navy-900 transition-colors"
                  >
                    <DownloadCloud size={13} className="text-gray-400" />
                    <span className="uppercase text-xs font-medium bg-gray-100 px-1.5 py-0.5 rounded">{f.file_type}</span>
                    <span className="text-xs text-gray-400">{format(new Date(f.generated_at), 'MMM d, HH:mm')}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Check(props: any) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}
