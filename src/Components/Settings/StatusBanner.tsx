import { ShieldCheck, ShieldX } from 'lucide-react';

/** Reusable success/error banner used across Settings panels. */
export const StatusBanner = ({
    type,
    message,
    className = '',
}: {
    type: 'success' | 'error';
    message: string;
    /** Extra classes merged onto the outer div (e.g. 'mb-4'). */
    className?: string;
}) => {
    const isSuccess = type === 'success';
    const Icon = isSuccess ? ShieldCheck : ShieldX;
    const colorClass = isSuccess ? 'text-themegreen' : 'text-themeredred';
    const bgClass = isSuccess ? 'bg-themegreen/10' : 'bg-themeredred/10';

    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bgClass} ${className}`}>
            <Icon size={16} className={colorClass} />
            <span className={`text-sm ${colorClass} font-medium`}>{message}</span>
        </div>
    );
};
