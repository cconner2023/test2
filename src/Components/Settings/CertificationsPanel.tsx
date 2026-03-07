import { useState } from 'react';
import { Award, Plus, Star, Trash2, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Clock, Minus } from 'lucide-react';
import { useCertifications } from '../../Hooks/useCertifications';
import { credentials } from '../../Data/User';
import { LoadingSpinner } from '../LoadingSpinner';
import { useMinLoadTime } from '../../Hooks/useMinLoadTime';
import type { Certification } from '../../Data/User';

type ExpirationStatus = 'valid' | 'expiring' | 'expired' | 'none';

function getExpirationStatus(expDate: string | null): ExpirationStatus {
    if (!expDate) return 'none';
    const now = new Date();
    const exp = new Date(expDate);
    const diffMs = exp.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 0) return 'expired';
    if (diffDays <= 90) return 'expiring';
    return 'valid';
}

const expirationStyles: Record<ExpirationStatus, { bg: string; text: string; label: string }> = {
    valid: { bg: 'bg-themegreen/10', text: 'text-themegreen', label: 'Valid' },
    expiring: { bg: 'bg-themeyellow/10', text: 'text-themeyellow', label: 'Expiring Soon' },
    expired: { bg: 'bg-themeredred/10', text: 'text-themeredred', label: 'Expired' },
    none: { bg: 'bg-tertiary/5', text: 'text-tertiary/50', label: 'No Expiration' },
};

function CertCard({
    cert,
    onRemove,
    onTogglePrimary,
}: {
    cert: Certification;
    onRemove: (id: string, wasPrimary: boolean) => void;
    onTogglePrimary: (id: string, currentlyPrimary: boolean) => void;
}) {
    const [confirming, setConfirming] = useState(false);
    const expStatus = getExpirationStatus(cert.exp_date);
    const style = expirationStyles[expStatus];

    return (
        <div className="rounded-xl border border-tertiary/10 bg-themewhite2 overflow-hidden">
            <div className="px-4 py-3">
                {/* Title row */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-semibold text-primary truncate">{cert.title}</p>
                        {cert.is_primary && (
                            <Star size={14} className="text-themeyellow shrink-0 fill-themeyellow" />
                        )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {/* Verified badge */}
                        {cert.verified ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-themegreen/10 text-themegreen text-[9pt] font-medium">
                                <CheckCircle size={12} /> Verified
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-tertiary/5 text-tertiary/50 text-[9pt] font-medium">
                                <AlertCircle size={12} /> Unverified
                            </span>
                        )}
                    </div>
                </div>

                {/* Details */}
                <div className="mt-2 space-y-1">
                    {cert.cert_number && (
                        <p className="text-xs text-tertiary/60">
                            Cert #: <span className="font-medium text-primary/80">{cert.cert_number}</span>
                        </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-tertiary/60">
                        {cert.issue_date && (
                            <span>Issued: {new Date(cert.issue_date + 'T00:00:00').toLocaleDateString()}</span>
                        )}
                        {cert.exp_date && (
                            <span>Expires: {new Date(cert.exp_date + 'T00:00:00').toLocaleDateString()}</span>
                        )}
                    </div>
                </div>

                {/* Expiration badge */}
                <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9pt] font-medium ${style.bg} ${style.text}`}>
                        {expStatus === 'none' ? <Minus size={10} /> : <Clock size={10} />}
                        {style.label}
                    </span>
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-2 border-t border-tertiary/5 pt-2.5">
                    <button
                        onClick={() => onTogglePrimary(cert.id, cert.is_primary)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
                            ${cert.is_primary
                                ? 'bg-themeyellow/10 text-themeyellow hover:bg-themeyellow/20'
                                : 'bg-tertiary/5 text-tertiary/60 hover:bg-tertiary/10'
                            }`}
                    >
                        <Star size={12} className={cert.is_primary ? 'fill-themeyellow' : ''} />
                        {cert.is_primary ? 'Primary' : 'Set Primary'}
                    </button>

                    {confirming ? (
                        <div className="flex items-center gap-1.5 ml-auto">
                            <button
                                onClick={() => { onRemove(cert.id, cert.is_primary); setConfirming(false); }}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-themeredred text-white hover:bg-themeredred/90 transition-colors"
                            >
                                Confirm
                            </button>
                            <button
                                onClick={() => setConfirming(false)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-tertiary/10 text-primary hover:bg-tertiary/15 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setConfirming(true)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                                       bg-tertiary/5 text-tertiary/50 hover:bg-themeredred/10 hover:text-themeredred transition-colors ml-auto"
                        >
                            <Trash2 size={12} /> Remove
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function AddCertForm({ onAdd }: { onAdd: (input: {
    title: string;
    cert_number?: string | null;
    issue_date?: string | null;
    exp_date?: string | null;
    is_primary?: boolean;
}) => Promise<{ success: boolean; error?: string }> }) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [certNumber, setCertNumber] = useState('');
    const [issueDate, setIssueDate] = useState('');
    const [expDate, setExpDate] = useState('');
    const [isPrimary, setIsPrimary] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = () => {
        setTitle('');
        setCertNumber('');
        setIssueDate('');
        setExpDate('');
        setIsPrimary(false);
        setError(null);
    };

    const handleSubmit = async () => {
        if (!title.trim()) { setError('Title is required'); return; }
        setSubmitting(true);
        setError(null);

        const result = await onAdd({
            title: title.trim(),
            cert_number: certNumber.trim() || null,
            issue_date: issueDate || null,
            exp_date: expDate || null,
            is_primary: isPrimary,
        });

        setSubmitting(false);
        if (result.success) {
            reset();
            setOpen(false);
        } else {
            setError(result.error || 'Failed to add certification');
        }
    };

    return (
        <div className="rounded-xl border border-tertiary/10 overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center justify-between w-full px-4 py-3 hover:bg-themewhite2 transition-colors"
            >
                <span className="flex items-center gap-2 text-sm font-medium text-themeblue2">
                    <Plus size={16} /> Add Certification
                </span>
                {open ? <ChevronUp size={16} className="text-tertiary/40" /> : <ChevronDown size={16} className="text-tertiary/40" />}
            </button>

            {open && (
                <div className="px-4 pb-4 space-y-3 border-t border-tertiary/10">
                    <div className="pt-3">
                        {/* Title with datalist suggestions */}
                        <label className="block">
                            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
                                Title <span className="text-themeredred">*</span>
                            </span>
                            <input
                                type="text"
                                list="cert-suggestions"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. EMT-B, ACLS, BSN"
                                className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                                           border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                                           transition-colors placeholder:text-tertiary/30"
                            />
                            <datalist id="cert-suggestions">
                                {credentials.map(c => <option key={c} value={c} />)}
                            </datalist>
                        </label>
                    </div>

                    {/* Cert Number */}
                    <label className="block">
                        <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Cert Number</span>
                        <input
                            type="text"
                            value={certNumber}
                            onChange={(e) => setCertNumber(e.target.value)}
                            placeholder="Optional"
                            className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                                       border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                                       transition-colors placeholder:text-tertiary/30"
                        />
                    </label>

                    {/* Dates row */}
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Issue Date</span>
                            <input
                                type="date"
                                value={issueDate}
                                onChange={(e) => setIssueDate(e.target.value)}
                                className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                                           border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                                           transition-colors"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Exp Date</span>
                            <input
                                type="date"
                                value={expDate}
                                onChange={(e) => setExpDate(e.target.value)}
                                className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                                           border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                                           transition-colors"
                            />
                        </label>
                    </div>

                    {/* Primary checkbox */}
                    <label className="flex items-center gap-2 py-1 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isPrimary}
                            onChange={(e) => setIsPrimary(e.target.checked)}
                            className="rounded border-tertiary/20 text-themeblue2 focus:ring-themeblue2/30"
                        />
                        <span className="text-sm text-primary">Primary certification (shown on signature line)</span>
                    </label>

                    {error && (
                        <p className="text-xs text-themeredred">{error}</p>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !title.trim()}
                        className="w-full py-2.5 rounded-xl bg-themeblue2 text-white text-sm font-semibold
                                   hover:bg-themeblue2/90 active:scale-[0.98] transition-all
                                   disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Adding...' : 'Add Certification'}
                    </button>
                </div>
            )}
        </div>
    );
}

export const CertificationsPanel = () => {
    const { certs, loading, addCert, removeCert, togglePrimaryCert } = useCertifications();
    const showLoading = useMinLoadTime(loading);

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <div className="mb-5">
                    <h2 className="text-lg font-semibold text-primary">Certifications</h2>
                    <p className="text-sm text-tertiary/60 mt-1">
                        Manage your credentials and certification status.
                    </p>
                </div>

                {showLoading ? (
                    <LoadingSpinner label="Loading certifications..." className="py-12 text-tertiary" />
                ) : (
                    <div className="space-y-3">
                        {/* Cert list */}
                        {certs.length === 0 && (
                            <div className="flex flex-col items-center py-8 text-center">
                                <div className="w-12 h-12 rounded-full bg-tertiary/5 flex items-center justify-center mb-3">
                                    <Award size={22} className="text-tertiary/40" />
                                </div>
                                <p className="text-sm text-tertiary/50">No certifications added yet</p>
                            </div>
                        )}

                        {certs.map((cert) => (
                            <CertCard
                                key={cert.id}
                                cert={cert}
                                onRemove={removeCert}
                                onTogglePrimary={togglePrimaryCert}
                            />
                        ))}

                        {/* Add form */}
                        <AddCertForm onAdd={addCert} />
                    </div>
                )}
            </div>
        </div>
    );
};
