import { useRef, useCallback } from 'react';
import { Camera, ImagePlus, Check, X } from 'lucide-react';

export interface ImportInputBarProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onClose: () => void;
    onScan?: () => void;
    onImage?: (file: File) => void;
    error?: string;
    inputRef?: React.RefObject<HTMLInputElement | null>;
    fileRef?: React.RefObject<HTMLInputElement | null>;
    placeholder?: string;
    className?: string;
    isDecodingImage?: boolean;
}

const ACTION_BUTTON = 'w-11 h-11 rounded-full flex items-center justify-center bg-themewhite2 border border-themeblue1/30 text-tertiary hover:text-primary focus:outline-none active:scale-95 transition-all duration-300';

export function ImportInputBar({
    value,
    onChange,
    onSubmit,
    onClose,
    onScan,
    onImage,
    error,
    inputRef,
    fileRef,
    placeholder = 'Paste code or scan',
    className,
    isDecodingImage,
}: ImportInputBarProps) {
    const internalFileRef = useRef<HTMLInputElement>(null);
    const fileInputRef = fileRef || internalFileRef;
    const hasText = value.trim().length > 0;

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onImage?.(file);
        e.target.value = '';
    }, [onImage]);

    return (
        <div className={`relative flex items-center gap-2 ${className ?? ''}`}>
            {!hasText && (onScan || onImage) && (
                <div className="flex items-center gap-2 shrink-0">
                    {onScan && (
                        <button
                            type="button"
                            onClick={onScan}
                            className={ACTION_BUTTON}
                            title="Scan barcode"
                        >
                            <Camera size={20} />
                        </button>
                    )}
                    {onImage && (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isDecodingImage}
                            className={`${ACTION_BUTTON} disabled:opacity-40`}
                            title={isDecodingImage ? 'Reading image...' : 'Upload image'}
                        >
                            <ImagePlus size={20} />
                        </button>
                    )}
                </div>
            )}
            <form
                onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
                className="flex-1 min-w-0"
            >
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full rounded-full py-2.5 px-4 border shadow-xs bg-themewhite2 focus:outline-none text-base text-primary placeholder:text-tertiary/30 transition-all duration-300 ${
                        error ? 'border-themeredred/30' : 'border-themeblue1/30'
                    }`}
                />
            </form>
            <button
                type="button"
                onClick={onClose}
                className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all duration-300 bg-themewhite2 border border-themeblue3/10 text-tertiary hover:text-primary"
                aria-label="Close import"
                title="Close import"
            >
                <X style={{ width: 24, height: 24 }} />
            </button>
            {hasText && (
                <button
                    type="button"
                    onClick={onSubmit}
                    className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all duration-300 bg-themeblue3 text-white border border-themeblue1/30"
                    aria-label="Decode"
                    title="Decode"
                >
                    <Check style={{ width: 20, height: 20 }} />
                </button>
            )}
            {error && (
                <div className={`absolute left-0 right-0 top-full mt-1.5 transition-all duration-300 ease-out ${
                    error ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
                }`}>
                    <p className="text-xs font-medium text-themeredred bg-themeredred/5 rounded-full px-4 py-1.5 text-center">
                        {error}
                    </p>
                </div>
            )}
            {onImage && (
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                />
            )}
        </div>
    );
}
