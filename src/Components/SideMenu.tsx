// Components/SideMenu.tsx
import { useEffect, useState, useRef } from "react"
import { menuData } from "../Data/CatData"
import {
    Settings,
    Upload,
    Pill,
    FileText,
    HelpCircle,
    BarChart3,
    Users,
    Calendar,
    Bell,
    Shield
} from "lucide-react"

interface SideMenuProps {
    isVisible?: boolean
    onClose?: () => void
    onImportClick?: () => void
    onMedicationClick?: () => void
    onToggleTheme?: () => void
    onSettingsClick?: () => void
}

// Map menu actions to corresponding icons
const iconMap: Record<string, React.ReactNode> = {
    'import': <Upload size={16} className="mr-3 text-primary/70" />,
    'medications': <Pill size={16} className="mr-3 text-primary/70" />,
    'Settings': <Settings size={16} className="mr-3 text-primary/70" />,
    'myNotes': <BarChart3 size={16} className="mr-3 text-primary/70" />,
    'patients': <Users size={16} className="mr-3 text-primary/70" />,
    'schedule': <Calendar size={16} className="mr-3 text-primary/70" />,
    'notifications': <Bell size={16} className="mr-3 text-primary/70" />,
    'security': <Shield size={16} className="mr-3 text-primary/70" />,
    'help': <HelpCircle size={16} className="mr-3 text-primary/70" />,
    'documents': <FileText size={16} className="mr-3 text-primary/70" />,
}

export function SideMenu({
    isVisible: externalIsVisible,
    onClose,
    onImportClick,
    onMedicationClick,
    onSettingsClick
}: SideMenuProps) {
    const [internalVisible, setInternalVisible] = useState(false)
    const [activeItem, setActiveItem] = useState<number | null>(null)
    const [itemsVisible, setItemsVisible] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    const isVisible = externalIsVisible !== undefined ? externalIsVisible : internalVisible

    useEffect(() => {
        if (externalIsVisible === undefined) {
            // Auto-show after delay
            setTimeout(() => {
                setInternalVisible(true)
                // Delay the items fade-in slightly to sync with menu opening
                setTimeout(() => setItemsVisible(true), 150)
            }, 300)
        } else if (externalIsVisible) {
            // Show items when external visibility is set
            setTimeout(() => setItemsVisible(true), 150)
        } else {
            // Hide items immediately when closing
            setItemsVisible(false)
        }
    }, [externalIsVisible, isVisible])

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
        const button = document.querySelector(`[data-menu-item="${index}"]`)
        button?.classList.add('scale-95')
        setTimeout(() => button?.classList.remove('scale-95'), 150)

        // Handle the click actions
        switch (action.toLowerCase()) {
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
        return iconMap[action] || <HelpCircle size={16} className="mr-3 text-primary/70" />;
    }

    return (
        <>
            {/* Backdrop overlay for mobile */}
            {isVisible && (
                <div
                    className="fixed inset-0 z-40 md:hidden"
                    onClick={onClose}
                />
            )}

            {/* Menu Container with Simple Scale Animation */}
            <div
                ref={menuRef}
                className={`
                    fixed left-5 top-3 z-50 py-3 pl-3 pr-5 
                    w-56 flex flex-col rounded-xl
                    border border-tertiary/20 
                    shadow-[0_2px_4px_0] shadow-themewhite2/20
                    backdrop-blur-md bg-themewhite2/10
                    transform-gpu
                    overflow-hidden
                    text-primary/80 text-sm
                    origin-top-left
                    transition-all duration-300 ease-out
                    ${isVisible
                        ? "opacity-100 scale-100 translate-x-0"
                        : "opacity-0 scale-10 -translate-x-1 pointer-events-none"
                    }
                `}
                style={{
                    transformOrigin: 'top left'
                }}
            >
                {/* Menu Items with fade animation */}
                <div className="relative z-10 space-y-0.5">
                    {menuData.map((item, index) => (
                        <button
                            key={index}
                            data-menu-item={index}
                            onClick={() => handleItemClick(index, item.action)}
                            className={`
                                w-full text-left
                                flex items-center pl-3 pr-4 py-3 
                                rounded-lg 
                                transition-all duration-300 ease-out
                                cursor-pointer
                                hover:bg-themeblue bg-transparent
                                active:scale-95
                                transform-gpu
                                ${itemsVisible
                                    ? "opacity-100 translate-y-0"
                                    : "opacity-0 translate-y-1"
                                }
                            `}
                            style={{
                                transitionDelay: itemsVisible
                                    ? `${index * 30}ms`
                                    : `${(menuData.length - index - 1) * 15}ms`,
                                transformOrigin: 'center'
                            }}
                        >
                            {/* Icon with subtle fade */}
                            <div
                                className="mr-3 text-primary/70 transition-all duration-300 ease-out"
                                style={{
                                    opacity: itemsVisible ? 1 : 0,
                                    transform: itemsVisible ? 'scale(1)' : 'scale(0.8)',
                                    transitionDelay: itemsVisible
                                        ? `${index * 30 + 10}ms`
                                        : `${(menuData.length - index - 1) * 15}ms`
                                }}
                            >
                                {getIconForItem(item.action)}
                            </div>

                            {/* Menu text with subtle fade */}
                            <span
                                className=" tracking-wide transition-all duration-300 ease-out"
                                style={{
                                    opacity: itemsVisible ? 1 : 0,
                                    transform: itemsVisible ? 'translateX(0)' : 'translateX(-8px)',
                                    transitionDelay: itemsVisible
                                        ? `${index * 30 + 10}ms`
                                        : `${(menuData.length - index - 1) * 15}ms`
                                }}
                            >
                                {item.text}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </>
    )
}