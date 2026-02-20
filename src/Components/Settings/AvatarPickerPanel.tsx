import { useRef } from 'react';
import { Check, Camera, X } from 'lucide-react';

export interface AvatarPickerPanelProps {
    avatarList: Array<{ id: string; svg: React.ReactNode }>;
    currentAvatarId: string;
    isCustom: boolean;
    customImage: string | null;
    onSelect: (id: string) => void;
    onUpload: (file: File) => void;
    onClearCustom: () => void;
}

export const AvatarPickerPanel = ({
    avatarList,
    currentAvatarId,
    isCustom,
    customImage,
    onSelect,
    onUpload,
    onClearCustom,
}: AvatarPickerPanelProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <div className="grid grid-cols-3 gap-4 justify-items-center md:grid-cols-4">
                    {/* Custom image avatar (if uploaded) */}
                    {customImage && (
                        <div className="relative">
                            <button
                                onClick={() => onSelect('custom')}
                                className="relative w-16 h-16 rounded-full overflow-hidden transition-all active:scale-95"
                            >
                                <img src={customImage} alt="Custom" className="w-full h-full object-cover" />
                                {isCustom && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
                                        <Check size={20} className="text-white" />
                                    </div>
                                )}
                            </button>
                            <button
                                onClick={onClearCustom}
                                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-themeredred flex items-center justify-center active:scale-90 transition-transform"
                                aria-label="Remove custom photo"
                            >
                                <X size={12} className="text-white" />
                            </button>
                        </div>
                    )}

                    {/* SVG avatars */}
                    {avatarList.map((avatar) => (
                        <button
                            key={avatar.id}
                            onClick={() => onSelect(avatar.id)}
                            className="relative w-16 h-16 rounded-full overflow-hidden transition-all active:scale-95"
                        >
                            {avatar.svg}
                            {avatar.id === currentAvatarId && !isCustom && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
                                    <Check size={20} className="text-white" />
                                </div>
                            )}
                        </button>
                    ))}

                    {/* Upload button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-16 h-16 rounded-full border-2 border-dashed border-tertiary/30
                                   flex items-center justify-center transition-all active:scale-95
                                   hover:border-tertiary/50 hover:bg-themewhite2/50"
                        aria-label="Upload photo"
                    >
                        <Camera size={22} className="text-tertiary/50" />
                    </button>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onUpload(file);
                        e.target.value = '';
                    }}
                />
            </div>
        </div>
    );
};
