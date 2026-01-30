// Components/SideMenu.tsx
import { useEffect, useState } from "react"
import { menuData } from "../Data/CatData"
import { Settings } from "lucide-react"

interface SideMenuProps {
    isVisible?: boolean
    onClose?: () => void
    onImportClick?: () => void
    onMedicationClick?: () => void
    onToggleTheme?: () => void
    onSettingsClick?: () => void
}

export function SideMenu({
    isVisible: externalIsVisible,
    onClose,
    onImportClick,
    onMedicationClick,
    onToggleTheme,
    onSettingsClick
}: SideMenuProps) {
    const [internalVisible, setInternalVisible] = useState(false)
    const [activeItem, setActiveItem] = useState<number | null>(null)

    const isVisible = externalIsVisible !== undefined ? externalIsVisible : internalVisible

    useEffect(() => {
        if (externalIsVisible === undefined) {
            setTimeout(() => setInternalVisible(true), 1000)
        }
    }, [externalIsVisible])

    const handleItemClick = (index: number, action: string) => {
        setActiveItem(index)

        switch (action) {
            case 'import':
                onImportClick?.()
                break
            case 'medications':
                onMedicationClick?.()
                break
            case 'toggleTheme':
                onToggleTheme?.()
                break
            case 'settings':
                onSettingsClick?.()
                break
            default:
                console.warn("Unknown menu action:", action)
        }
        onClose?.()
    }

    return (
        <>
            {/* Backdrop overlay for mobile */}
            {isVisible && (
                <div
                    className="fixed inset-0 z-40 md:hidden transition-all duration-300"
                    onClick={onClose}
                />
            )}

            {/* Menu Container */}
            <div className={`absolute left-2 top-13.75 z-50 ml-2.5 py-2.5 pl-2.5 pr-4 w-max flex flex-col rounded-lg border border-primary/10 shadow-[0px_1px_2px] shadow-[rgba(0,0,0,0.05)] bg-themewhite transition-all ease-in-out duration-300 will-change-[opacity,height] text-primary/70 text-sm backface-hidden overflow-hidden h-10 opacity-0 invisible scale-90 -translate-x-2 -translate-y-5 ${isVisible ? "h-max scale-100 opacity-100 visible translate-x-0 translate-y-0" : ""}`}>

                {menuData.map((item, index) => (
                    <div
                        key={index}
                        onClick={() => handleItemClick(index, item.action)}
                        className={`flex items-center pl-4.5 pr-4.5 pt-2.5 pb-2.5 rounded-md hover:bg-themewhite2 transition-all duration-500 cursor-pointer ${activeItem === index ? 'bg-themewhite2' : ''}`}
                    >
                        <span>{item.text}</span>
                    </div>
                ))}

                {/* Settings Menu Item - Added at the bottom */}
                <div className="border-t border-primary/5 mt-1 pt-1">
                    <div
                        onClick={() => {
                            setActiveItem(null)
                            onSettingsClick?.()
                            onClose?.()
                        }}
                        className={`flex items-center pl-4.5 pr-4.5 pt-2.5 pb-2.5 rounded-md hover:bg-themewhite2 transition-all duration-500 cursor-pointer ${activeItem === null ? 'bg-themewhite2' : ''}`}
                    >
                        <Settings size={16} className="mr-3 text-primary/70" />
                        <span className="text-primary/70">Settings</span>
                    </div>
                </div>
            </div>
        </>
    )
}