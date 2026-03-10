import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../Hooks/useAuth';
import { PasswordInput } from '../FormInputs';
import { ErrorDisplay } from '../ErrorDisplay';

export const ChangePasswordPanel = () => {
    const { user } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const isValid = currentPassword.length > 0 && newPassword.length >= 12 && newPassword === confirm;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid || !user?.email) return;

        setError(null);
        setSubmitting(true);

        // Verify current password
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
        });

        if (signInError) {
            setSubmitting(false);
            setError('Current password is incorrect');
            return;
        }

        // Update to new password
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
                <div className="px-4 py-3 md:p-5 flex flex-col items-center justify-center pt-16">
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
                <div className="mb-5">
                    <h2 className="text-lg font-semibold text-primary">Change Password</h2>
                    <p className="text-sm text-tertiary/60 mt-1">
                        Enter your current password and choose a new one.
                    </p>
                </div>

                <ErrorDisplay message={error} centered />

                <form onSubmit={handleSubmit} className="space-y-4">
                    <PasswordInput
                        label="Current Password"
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        placeholder="Enter current password"
                        autoComplete="current-password"
                    />

                    <PasswordInput
                        label="New Password"
                        value={newPassword}
                        onChange={setNewPassword}
                        placeholder="Min 12 characters"
                        autoComplete="new-password"
                        hint={newPassword.length > 0 && newPassword.length < 12 && (
                            <p className="text-xs text-themeredred mt-1">Password must be at least 12 characters</p>
                        )}
                    />

                    <PasswordInput
                        label="Confirm New Password"
                        value={confirm}
                        onChange={setConfirm}
                        placeholder="Re-enter new password"
                        autoComplete="new-password"
                        hint={confirm.length > 0 && newPassword !== confirm && (
                            <p className="text-xs text-themeredred mt-1">Passwords do not match</p>
                        )}
                    />

                    <button
                        type="submit"
                        disabled={!isValid || submitting}
                        className="w-full px-4 py-3 rounded-lg bg-themeblue3 text-white font-medium
                                   hover:bg-themeblue3/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Updating Password...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};
