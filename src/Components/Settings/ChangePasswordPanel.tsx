import { useState } from 'react';
import { CheckCircle, Check, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../Hooks/useAuth';
import { ErrorDisplay } from '../ErrorDisplay';
import { PasswordInput } from '../FormInputs';
import { ActionPill } from '../ActionPill';
import { ActionButton } from '../ActionButton';

export const ChangePasswordPanel = () => {
    const { user } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const isValid = currentPassword.length > 0 && newPassword.length >= 12 && newPassword === confirm;

    const handleSubmit = async () => {
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
                <div className="px-5 pb-4 flex flex-col items-center justify-center pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
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
            <div className="px-4 pb-3 md:px-5 md:pb-5 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
                <ErrorDisplay message={error} centered />

                <p className="text-[10pt] text-tertiary leading-relaxed px-1 mb-2">Enter your current password and choose a new one.</p>

                <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                    <PasswordInput
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        placeholder="Current password"
                        autoComplete="current-password"
                    />
                    <PasswordInput
                        value={newPassword}
                        onChange={setNewPassword}
                        placeholder="New password (min 12 characters)"
                        autoComplete="new-password"
                        hint={newPassword.length > 0 && newPassword.length < 12 ? 'Password must be at least 12 characters' : undefined}
                    />
                    <PasswordInput
                        value={confirm}
                        onChange={setConfirm}
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        hint={confirm.length > 0 && newPassword !== confirm ? 'Passwords do not match' : undefined}
                    />
                </div>

                <div className="flex items-center justify-end pt-3">
                    <ActionPill shadow="sm">
                        <ActionButton
                            icon={submitting ? RefreshCw : Check}
                            label={submitting ? 'Updating…' : 'Update password'}
                            variant={isValid && !submitting ? 'success' : 'disabled'}
                            onClick={handleSubmit}
                        />
                    </ActionPill>
                </div>
            </div>
        </div>
    );
};
