import { useState } from 'react';
import { CheckCircle, Check, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../Hooks/useAuth';
import { ErrorDisplay } from '../ErrorDisplay';

const pillInput = 'w-full rounded-full py-2.5 px-4 border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm bg-themewhite text-primary placeholder:text-tertiary transition-all duration-300';

export const ChangePasswordPanel = () => {
    const { user } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const isValid = currentPassword.length > 0 && newPassword.length >= 12 && newPassword === confirm;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid || !user?.email) return;

        setError(null);
        setSubmitting(true);

        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
        });

        if (signInError) {
            setSubmitting(false);
            setError('Current password is incorrect');
            return;
        }

        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

        setSubmitting(false);

        if (updateError) {
            setError(updateError.message);
        } else {
            setSuccess(true);
            setCurrentPassword('');
            setNewPassword('');
            setConfirm('');
        }
    };

    if (success) {
        return (
            <div className="h-full overflow-y-auto">
                <div className="px-5 py-4 flex flex-col items-center justify-center pt-16">
                    <div className="w-14 h-14 rounded-full bg-themegreen/10 flex items-center justify-center mb-4">
                        <CheckCircle size={28} className="text-themegreen" />
                    </div>
                    <h2 className="text-lg font-semibold text-primary">Password Updated</h2>
                    <p className="text-sm text-tertiary mt-2 text-center">
                        Your password has been changed successfully.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <ErrorDisplay message={error} centered />

                <form onSubmit={handleSubmit}>
                    <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                        <div className="px-4 py-3 space-y-2">
                            <p className="text-[10pt] text-tertiary leading-relaxed">Enter your current password and choose a new one.</p>

                            {/* Current password */}
                            <div>
                                <div className="relative">
                                    <input
                                        type={showCurrent ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        placeholder="Current password"
                                        autoComplete="current-password"
                                        className={`${pillInput} pr-10`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrent(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-tertiary transition-colors"
                                    >
                                        {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* New password */}
                            <div>
                                <div className="relative">
                                    <input
                                        type={showNew ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="New password (min 12 characters)"
                                        autoComplete="new-password"
                                        className={`${pillInput} pr-10`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNew(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-tertiary transition-colors"
                                    >
                                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {newPassword.length > 0 && newPassword.length < 12 && (
                                    <p className="text-[10pt] text-themeredred mt-1">Password must be at least 12 characters</p>
                                )}
                            </div>

                            {/* Confirm password */}
                            <div>
                                <div className="relative">
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        value={confirm}
                                        onChange={e => setConfirm(e.target.value)}
                                        placeholder="Confirm new password"
                                        autoComplete="new-password"
                                        className={`${pillInput} pr-10`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-tertiary transition-colors"
                                    >
                                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {confirm.length > 0 && newPassword !== confirm && (
                                    <p className="text-[10pt] text-themeredred mt-1">Passwords do not match</p>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-1.5 pt-1">
                                <button
                                    type="submit"
                                    disabled={!isValid || submitting}
                                    className="w-10 h-10 rounded-full bg-themeblue3 text-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? <RefreshCw size={16} className="animate-spin" /> : <Check size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
