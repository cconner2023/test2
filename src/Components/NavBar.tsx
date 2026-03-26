import { BookOpen, Mail, Package, Radio, Map } from "lucide-react";
import { useAvatar } from "../Utilities/AvatarContext";
import { useAuth } from "../Hooks/useAuth";
import { useTotalUnread } from "../stores/useMessagingStore";
import { getInitials } from "../Utilities/nameUtils";

interface NavBarProps {
    onKnowledgeBaseClick: () => void
    onMessagesClick: () => void
    onPropertyClick: () => void
    onLoRaClick: () => void
    onMapOverlayClick: () => void
    onAvatarClick: () => void
}

const BTN = "h-8 flex items-center justify-center px-3 lg:px-4 py-1.5 bg-themewhite2 hover:bg-themewhite rounded-full transition-all duration-300 gap-2";

export function NavBar({ onKnowledgeBaseClick, onMessagesClick, onPropertyClick, onLoRaClick, onMapOverlayClick, onAvatarClick }: NavBarProps) {
    const { currentAvatar, customImage, isCustom, isInitials } = useAvatar()
    const { profile, isAuthenticated, isDevRole } = useAuth()
    const totalUnread = useTotalUnread()

    return (
        <div className="hidden md:flex items-center h-10 w-full px-3 bg-themewhite gap-2">
            {/* Avatar */}
            <button
                onClick={onAvatarClick}
                className="w-8 h-8 rounded-full overflow-hidden shrink-0 active:scale-95 transition-transform"
                aria-label="Profile"
            >
                {isCustom && customImage ? (
                    <img src={customImage} alt="Profile" className="w-full h-full object-cover rounded-full" />
                ) : isInitials ? (
                    <div className="w-full h-full rounded-full bg-themeblue2/15 flex items-center justify-center">
                        <span className="text-xs font-semibold text-themeblue2">
                            {getInitials(profile.firstName, profile.lastName)}
                        </span>
                    </div>
                ) : (
                    <div className="w-full h-full rounded-full overflow-hidden">
                        {currentAvatar.svg}
                    </div>
                )}
            </button>

            {/* Knowledge Base */}
            <button onClick={onKnowledgeBaseClick} className={BTN} aria-label="Knowledge Base" title="Knowledge Base">
                <BookOpen className="w-4 h-4 stroke-themeblue1" />
                <span className="hidden lg:inline text-[10pt] text-tertiary">Knowledge Base</span>
            </button>

            {/* Messages — gated on auth */}
            {isAuthenticated && (
                <button onClick={onMessagesClick} className={`${BTN} relative`} aria-label="Messages" title="Messages">
                    <Mail className="w-4 h-4 stroke-themeblue1" />
                    <span className="hidden lg:inline text-[10pt] text-tertiary">Messages</span>
                    {totalUnread > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-themeredred text-white text-[10px] font-bold leading-none">
                            {totalUnread > 99 ? '99+' : totalUnread}
                        </span>
                    )}
                </button>
            )}

            {/* Property — beta, auth required */}
            {isAuthenticated && isDevRole && (
                <button onClick={onPropertyClick} className={BTN} aria-label="Property Book" title="Property Book">
                    <Package className="w-4 h-4 stroke-themeblue1" />
                    <span className="hidden lg:inline text-[10pt] text-tertiary">Property</span>
                </button>
            )}

            {/* LoRa — beta, auth required */}
            {isAuthenticated && isDevRole && (
                <button onClick={onLoRaClick} className={BTN} aria-label="WhisperNet" title="WhisperNet">
                    <Radio className="w-4 h-4 stroke-themeblue1" />
                    <span className="hidden lg:inline text-[10pt] text-tertiary">WhisperNet</span>
                </button>
            )}

            {/* Map Overlay — beta, auth required */}
            {isAuthenticated && isDevRole && (
                <button onClick={onMapOverlayClick} className={BTN} aria-label="Map Overlay" title="Map Overlay">
                    <Map className="w-4 h-4 stroke-themeblue1" />
                    <span className="hidden lg:inline text-[10pt] text-tertiary">Map</span>
                </button>
            )}
        </div>
    )
}
