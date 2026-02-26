import { User, Award, KeyRound, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '../../Hooks/useAuth';

interface ProfilePageProps {
    avatarSvg: React.ReactNode;
    customImage: string | null;
    isCustom: boolean;
    onAvatarClick: () => void;
    onNavigate: (panel: 'user-profile-details' | 'certifications' | 'change-password') => void;
    onSignOut: () => void;
}

export const ProfilePage = ({
    avatarSvg,
    customImage,
    isCustom,
    onAvatarClick,
    onNavigate,
    onSignOut,
}: ProfilePageProps) => {
    const { profile } = useAuth();

    const displayName = profile.lastName
        ? `${profile.rank ? profile.rank + ' ' : ''}${profile.firstName || ''} ${profile.lastName}`
        : 'Set Up Profile';

    const displayCredential = profile.credential
        ? `${profile.credential}${profile.component ? ' \u00b7 ' + profile.component : ''}`
        : null;

    const displayClinic = profile.clinicName
        ? `${profile.clinicName}${profile.uic ? ' \u00b7 ' + profile.uic : ''}`
        : profile.uic
            ? `UIC: ${profile.uic}`
            : null;

    const menuItems = [
        { icon: <User size={20} />, label: 'Update User Information', panel: 'user-profile-details' as const, color: 'text-themeblue2' },
        { icon: <Award size={20} />, label: 'Certifications', panel: 'certifications' as const, color: 'text-themeblue2' },
        { icon: <KeyRound size={20} />, label: 'Change Password', panel: 'change-password' as const, color: 'text-themeblue2' },
    ];

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                {/* Avatar + User Info */}
                <div className="flex items-center px-4 py-3.5 md:px-5 md:py-3.5 mb-4">
                    <div className="mr-4 flex flex-col items-center shrink-0">
                        <button
                            onClick={onAvatarClick}
                            className="w-12 h-12 rounded-full overflow-hidden active:scale-95 transition-transform"
                        >
                            {isCustom && customImage ? (
                                <img src={customImage} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full">{avatarSvg}</div>
                            )}
                        </button>
                        <button
                            onClick={onAvatarClick}
                            className="mt-1.5 text-[11px] font-medium text-themeblue2 active:opacity-70 transition-opacity"
                        >
                            Edit Photo
                        </button>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-primary md:text-[12pt] truncate">{displayName}</p>
                        {displayCredential && (
                            <p className="text-xs text-tertiary md:text-sm mt-0.5 truncate">{displayCredential}</p>
                        )}
                        {displayClinic && (
                            <p className="text-xs text-tertiary md:text-sm mt-0.5 truncate">{displayClinic}</p>
                        )}
                    </div>
                </div>

                {/* Menu Items */}
                <div className="border-t border-tertiary/10 pt-2">
                    {menuItems.map((item) => (
                        <button
                            key={item.panel}
                            onClick={() => onNavigate(item.panel)}
                            className="flex items-center w-full px-5 py-3.5 hover:bg-themewhite2 active:scale-[0.98]
                                       transition-all rounded-xl group"
                        >
                            <div className={`mr-4 ${item.color} group-hover:scale-110 transition-transform`}>
                                {item.icon}
                            </div>
                            <span className="flex-1 text-left text-base text-primary font-medium">
                                {item.label}
                            </span>
                            <ChevronRight size={18} className="text-tertiary/40" />
                        </button>
                    ))}

                    {/* Sign Out */}
                    <button
                        onClick={onSignOut}
                        className="flex items-center w-full px-5 py-3.5 hover:bg-themeredred/5 active:scale-[0.98]
                                   transition-all rounded-xl group mt-2"
                    >
                        <div className="mr-4 text-themeredred group-hover:scale-110 transition-transform">
                            <LogOut size={20} />
                        </div>
                        <span className="flex-1 text-left text-base text-themeredred font-medium">
                            Sign Out
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};
