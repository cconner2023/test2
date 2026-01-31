// Components/SideMenu.tsx - Fixed version
import { useEffect, useState, useRef } from "react"
import { menuData } from "../Data/CatData"
import { Settings, Upload, Pill, FileText, HelpCircle, BarChart3, Users, Calendar, Bell, Shield } from "lucide-react"

interface SideMenuProps {
    isVisible?: boolean
    onClose?: () => void
    onImportClick?: () => void
    onMedicationClick?: () => void
    onToggleTheme?: () => void
    onSettingsClick?: () => void
    menuButtonWidth?: number
    menuButtonPosition?: { x: number, y: number } // Add position prop
}

// Map menu actions to corresponding icons
const iconMap: Record<string, React.ReactNode> = {
    'import': <Upload size={16} className="mr-3 text-primary/70 transition-colors group-hover:text-primary/90" />,
    'medications': <Pill size={16} className="mr-3 text-primary/70 transition-colors group-hover:text-primary/90" />,
    'reports': <BarChart3 size={16} className="mr-3 text-primary/70 transition-colors group-hover:text-primary/90" />,
    'patients': <Users size={16} className="mr-3 text-primary/70 transition-colors group-hover:text-primary/90" />,
    'schedule': <Calendar size={16} className="mr-3 text-primary/70 transition-colors group-hover:text-primary/90" />,
    'notifications': <Bell size={16} className="mr-3 text-primary/70 transition-colors group-hover:text-primary/90" />,
    'security': <Shield size={16} className="mr-3 text-primary/70 transition-colors group-hover:text-primary/90" />,
    'help': <HelpCircle size={16} className="mr-3 text-primary/70 transition-colors group-hover:text-primary/90" />,
    'documents': <FileText size={16} className="mr-3 text-primary/70 transition-colors group-hover:text-primary/90" />,
}

// Reusable Menu Item Component
interface MenuItemProps {
    icon: React.ReactNode
    text: string
    onClick: () => void
}

function MenuItem({ icon, text, onClick }: MenuItemProps) {
    return (
        <button
            onClick={onClick}
            className={`
                w-full text-left
                flex items-center pl-3 pr-4 py-2.5 
                rounded-lg 
                transition-all duration-150
                cursor-pointer
                hover:bg-themewhite2/80
                active:bg-themewhite2
                border border-transparent
                hover:border-themeblue3/20
                group
            `}
        >
            <div className="transition-transform duration-150 group-hover:scale-105">
                {icon}
            </div>
            <span className="font-medium transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-primary">
                {text}
            </span>
        </button>
    )
}

export function SideMenu({
    isVisible: externalIsVisible,
    onClose,
    onImportClick,
    onMedicationClick,
    onSettingsClick,
    menuButtonWidth = 44,
    menuButtonPosition = { x: 16, y: 56 } // Default position
}: SideMenuProps) {
    const [internalVisible, setInternalVisible] = useState(false)
    const [activeItem, setActiveItem] = useState<number | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    const isVisible = externalIsVisible !== undefined ? externalIsVisible : internalVisible

    useEffect(() => {
        if (externalIsVisible === undefined) {
            setTimeout(() => setInternalVisible(true), 1000)
        }
    }, [externalIsVisible])

    // Handle clicks outside the menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose?.()
            }
        }

        if (isVisible) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isVisible, onClose])

    const handleItemClick = (index: number, action: string) => {
        setActiveItem(index)
        switch (action) {
            case 'import':
                onImportClick?.()
                break
            case 'medications':
                onMedicationClick?.()
                break
            case 'settings':
                onSettingsClick?.()
                break
            default:
                console.warn("Unknown menu action:", action)
        }
        onClose?.()
    }

    const getIconForItem = (action: string) => {
        return iconMap[action] || <HelpCircle size={16} className="mr-3 text-primary/70 transition-colors group-hover:text-primary/90" />
    }

    return (
        <>
            {/* Simple backdrop overlay */}
            {isVisible && (
                <div
                    className="fixed inset-0 z-40 md:hidden bg-transparent"
                    onClick={onClose}
                />
            )}
            <div
                ref={menuRef}
                className={`
                    fixed z-50 pt-3 pb-3 pl-2 pr-5 
                    flex flex-col rounded-xl
                    border border-tertiary/10 
                    shadow-lg shadow-tertiary/10
                    backdrop-blur-md bg-themewhite/80
                    transition-all duration-300 ease-out
                    will-change-transform
                    overflow-hidden
                    text-primary/80 text-sm
                    origin-top-left
                    transform-gpu
                    ${isVisible
                        ? "scale-100 opacity-100 visible w-auto h-auto"
                        : "scale-75 opacity-0 h-44px"
                    }
                `}
            >
                {/* Menu Items Container - Only visible when expanded */}
                <div className={`overflow-hidden transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 h-0'}`}>
                    <div className="relative z-10 space-y-0.5 py-1">
                        {menuData.map((item, index) => (
                            <MenuItem
                                key={index}
                                icon={getIconForItem(item.action)}
                                text={item.text}
                                onClick={() => handleItemClick(index, item.action)}
                            />
                        ))}
                    </div>

                    {/* Subtle divider */}
                    <div className="relative my-1.5">
                        <div className="w-full border-t border-themeblue3/10" />
                    </div>

                    {/* Settings Menu Item */}
                    <MenuItem
                        icon={<Settings size={16} className="mr-3 text-primary/70 transition-colors group-hover:text-primary/90" />}
                        text="Settings"
                        onClick={() => {
                            setActiveItem(null)
                            onSettingsClick?.()
                            onClose?.()
                        }}
                    />
                </div>

                {/* Bottom accent - only show when expanded */}
                {isVisible && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-themeblue3/20 to-transparent" />
                )}
            </div>
        </>
    )
}