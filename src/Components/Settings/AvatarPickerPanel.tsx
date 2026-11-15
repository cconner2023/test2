import { useRef } from 'react';
import { Check, Camera, X } from 'lucide-react';
import { useAvatar } from '../../Utilities/AvatarContext';
import { useAuth } from '../../Hooks/useAuth';
import { getInitials } from '../../Utilities/nameUtils';
import { SettingsPage } from './SettingsPage';

export interface AvatarPickerPanelProps {
    onSelect: (id: string) => void;
    onUpload: (file: File) => void;
}

export const AvatarPickerPanel = ({
    onSelect,
    onUpload,
}: AvatarPickerPanelProps) => {
    const { avatarList, currentAvatar, isCustom, isInitials, customImage, clearCustomImage } = useAvatar();
    const { profile } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const initials = getInitials(profile.firstName, profile.lastName);

    return (
        <SettingsPage className="h-full" split={false}>
            <div>
                <div className="grid grid-cols-3 gap-4 justify-items-center @md/page:grid-cols-4 @2xl/page:grid-cols-6 @4xl/page:grid-cols-8 @6xl/page:grid-cols-10">
                    {/* Initials avatar */}
                    <button
                        onClick={() => onSelect('initials')}
                        className="relative w-16 h-16 rounded-full overflow-hidden transition-all active:scale-95
                                   bg-themeblue2/15 flex items-center justify-center"
                    >
                        <span className="text-lg font-semibold text-themeblue2">{initials}</span>
                        {isInitials && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
                                <Check size={20} className="text-white" />
                            </div>
                        )}
                    </button>

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
                                onClick={clearCustomImage}
                                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-themeredred flex items-center justify-center active:scale-95 transition-transform"
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
                            {avatar.id === currentAvatar.id && !isCustom && !isInitials && (
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
                        <Camera size={22} className="text-tertiary" />
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
        </SettingsPage>
    );
};
