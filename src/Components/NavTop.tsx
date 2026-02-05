// NavTop.tsx - Simplified version with grouped props
import { Search, X, Menu, ChevronLeft, Upload, Info, Settings, Pill, BarChart3, HelpCircle } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import type { NavTopProps } from "../Types/NavTopTypes";
import { menuData } from "../Data/CatData";

export type MobileViewState = 'visible' | 'hidden'

// Icon map for menu items
const iconMap: Record<string, React.ReactNode> = {
    'import': <Upload size={16} className="text-primary/70" />,
    'medications': <Pill size={16} className="text-primary/70" />,
    'Settings': <Settings size={16} className="text-primary/70" />,
    'myNotes': <BarChart3 size={16} className="text-primary/70" />,
};

export function NavTop({ search, actions, ui }: NavTopProps) {
    // Destructure grouped props for cleaner usage
    const {
        searchInput,
        onSearchChange,
        onSearchFocus,
        onSearchClear,
        searchInputRef,
        isSearchExpanded = false,
        onSearchExpandToggle,
    } = search

    const {
        onBackClick,
        onMenuClick,
        onMenuClose,
        onImportClick,
        onMedicationClick,
        onSettingsClick,
        onInfoClick,
    } = actions

    const {
        showBack = false,
        showMenu = false,
        dynamicTitle,
        showDynamicTitle = false,
        medicationButtonText = "Medications",
        isMobile,
        isAlgorithmView = false,
        isMenuOpen = false,
    } = ui

    // Refs and computed values
    const internalInputRef = useRef<HTMLInputElement>(null);
    const inputRef = searchInputRef || internalInputRef;
    const hasSearchInput = searchInput.trim().length > 0;

    // Mobile-specific UI flags
    const shouldShowInfoButton = isMobile && isAlgorithmView && !isSearchExpanded;
    const shouldShowMenuButton = showMenu && isMobile;

    // Menu morph: staggered item visibility
    const [itemsVisible, setItemsVisible] = useState(false);

    useEffect(() => {
        if (isMenuOpen) {
            const timer = setTimeout(() => setItemsVisible(true), 150);
            return () => clearTimeout(timer);
        } else {
            setItemsVisible(false);
        }
    }, [isMenuOpen]);

    // Menu item click handler
    const handleMenuItemClick = (action: string) => {
        switch (action.toLowerCase()) {
            case 'import':
                onImportClick?.();
                break;
            case 'medications':
                onMedicationClick?.();
                break;
            case 'settings':
                onSettingsClick?.();
                break;
            default:
                console.warn("Unknown menu action:", action);
        }
        onMenuClose?.();
    };

    // Focus input when mobile search expands
    useEffect(() => {
        if (isSearchExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isSearchExpanded, inputRef]);

    // Handle mobile search icon click
    const handleMobileSearchClick = () => {
        if (!isSearchExpanded && onSearchExpandToggle) {
            onSearchExpandToggle();
            onSearchFocus?.();
        }
    };

    // Handle search input focus
    const handleSearchFocus = () => {
        if (isMobile && !isSearchExpanded && onSearchExpandToggle) {
            onSearchExpandToggle();
        }
        onSearchFocus?.();
    };

    // Handle search input blur
    const handleSearchBlur = () => {
        if (isMobile && !hasSearchInput && isSearchExpanded && onSearchExpandToggle) {
            onSearchExpandToggle();
        }
    };

    // Handle clear search - unified for both mobile and desktop
    const handleClearSearch = (shouldCollapse = false) => {
        onSearchChange("");
        onSearchClear?.();

        if (shouldCollapse && onSearchExpandToggle) {
            onSearchExpandToggle();
        } else {
            inputRef.current?.focus();
        }
    };

    // Button style constants - iOS standard tap target is 44px (w-11 h-11)
    const BUTTON_CLASSES = {
        mobileContainer: "rounded-full border border-tertiary/20 flex items-center p-0.5",
        mobileButton: "w-10 h-10 rounded-full flex items-center justify-center text-tertiary hover:text-primary transition-all duration-200",
        desktop: "h-8 flex items-center justify-center px-3 lg:px-4 py-1.5 bg-themewhite2 hover:bg-themewhite rounded-full transition-all duration-300"
    };

    return (
        <div className="flex items-center h-full w-full px-2 bg-themewhite transition-all duration-300">
            {/* Left section: buttons - hidden when mobile search is expanded */}
            {(!isMobile || !isSearchExpanded) && (
                <div className="flex items-center shrink-0">
                    {/* Mobile: Back button in its own container */}
                    {isMobile && showBack && (
                        <div className={BUTTON_CLASSES.mobileContainer}>
                            <button
                                onClick={onBackClick}
                                className={`${BUTTON_CLASSES.mobileButton} active:scale-90`}
                                aria-label="Go back"
                                title="Go back"
                            >
                                <ChevronLeft className="w-5 h-5 stroke-current" />
                            </button>
                        </div>
                    )}

                    {/* Mobile: Morphing menu button/panel */}
                    {shouldShowMenuButton && (
                        <div className="relative">
                            {/* Invisible spacer to maintain navbar layout */}
                            <div className="w-11.5 h-11.5" />

                            {/* Backdrop when menu is open */}
                            {isMenuOpen && (
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={onMenuClose}
                                />
                            )}

                            {/* Morphing container: button → menu panel (liquid glass) */}
                            <div
                                className={`
                                    absolute top-0 left-0 z-50
                                    transform-gpu
                                    overflow-hidden
                                    liquid-glass-menu
                                    ${isMenuOpen
                                        ? 'rounded-2xl py-3 pl-3 pr-5'
                                        : 'w-11.5 h-11.5 rounded-full p-0.5'
                                    }
                                `}
                                style={{
                                    transformOrigin: 'top left',
                                    width: isMenuOpen ? '224px' : '46px',
                                    maxHeight: isMenuOpen ? '400px' : '46px',
                                    transform: isMenuOpen
                                        ? 'translateX(4px)'
                                        : 'translate(0, 0)',
                                    transition: 'all 400ms',
                                    transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 2.2)',
                                }}
                            >
                                {/* Liquid glass layers - theme responsive */}
                                <div className="absolute inset-0 backdrop-blur-xl rounded-inherit" />
                                <div
                                    className="absolute inset-0 rounded-inherit liquid-glass-tint"
                                    style={{ opacity: isMenuOpen ? 1 : 0.6 }}
                                />
                                <div className="absolute inset-0 rounded-inherit pointer-events-none liquid-glass-shine" />
                                {/* Border overlay */}
                                <div className="absolute inset-0 rounded-inherit pointer-events-none border border-tertiary/20" />
                                {/* Toggle button: hamburger ↔ X crossfade with upward slide */}
                                <button
                                    onClick={isMenuOpen ? onMenuClose : onMenuClick}
                                    className={`
                                        relative z-10
                                        w-10 h-10 rounded-full flex items-center justify-center
                                        text-tertiary hover:text-primary transition-all
                                        ${isMenuOpen ? '' : 'active:scale-95'}
                                    `}
                                    style={{
                                        transform: isMenuOpen ? 'translateY(-6px)' : 'translateY(0)',
                                        transition: 'transform 500ms, color 200ms',
                                        transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.8)',
                                    }}
                                    aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                                >
                                    <div className="relative w-5 h-5">
                                        <Menu
                                            className={`w-5 h-5 stroke-current absolute inset-0 transition-all
                                                ${isMenuOpen ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`}
                                            style={{
                                                transitionDuration: '400ms',
                                                transitionTimingFunction: 'cubic-bezier(0.65, 0, 0.35, 1)',
                                            }}
                                        />
                                        <X
                                            className={`w-5 h-5 stroke-current absolute inset-0 transition-all
                                                ${isMenuOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`}
                                            style={{
                                                transitionDuration: '400ms',
                                                transitionTimingFunction: 'cubic-bezier(0.65, 0, 0.35, 1)',
                                            }}
                                        />
                                    </div>
                                </button>

                                {/* Menu items: staggered fade-in with spring */}
                                {isMenuOpen && (
                                    <div className="relative z-10 mt-1 space-y-0.5">
                                        {menuData.map((item, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleMenuItemClick(item.action)}
                                                className={`
                                                    w-full text-left flex items-center pl-3 pr-4 py-3
                                                    rounded-xl transition-all
                                                    cursor-pointer hover:bg-themewhite2/60 bg-transparent
                                                    active:scale-[0.97] transform-gpu
                                                    ${itemsVisible
                                                        ? "opacity-100 translate-y-0"
                                                        : "opacity-0 translate-y-4"
                                                    }
                                                `}
                                                style={{
                                                    transitionDuration: '500ms',
                                                    transitionDelay: itemsVisible
                                                        ? `${index * 70}ms`
                                                        : `${(menuData.length - index - 1) * 20}ms`,
                                                    transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
                                                }}
                                            >
                                                <div
                                                    className="mr-3 transition-all"
                                                    style={{
                                                        transitionDuration: '400ms',
                                                        opacity: itemsVisible ? 1 : 0,
                                                        transform: itemsVisible ? 'scale(1)' : 'scale(0.6)',
                                                        transitionDelay: itemsVisible
                                                            ? `${index * 70 + 50}ms`
                                                            : `${(menuData.length - index - 1) * 20}ms`,
                                                        transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
                                                    }}
                                                >
                                                    {iconMap[item.action] || <HelpCircle size={16} className="text-primary/70" />}
                                                </div>
                                                <span
                                                    className="tracking-wide text-sm text-primary/80 font-medium transition-all"
                                                    style={{
                                                        transitionDuration: '400ms',
                                                        opacity: itemsVisible ? 1 : 0,
                                                        transform: itemsVisible ? 'translateX(0)' : 'translateX(-12px)',
                                                        transitionDelay: itemsVisible
                                                            ? `${index * 70 + 80}ms`
                                                            : `${(menuData.length - index - 1) * 20}ms`,
                                                        transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
                                                    }}
                                                >
                                                    {item.text}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Desktop buttons - no menu button */}
                    {!isMobile && (
                        <div className="flex justify-center items-center space-x-2 shrink-0">
                            {showBack && (
                                <button
                                    onClick={onBackClick}
                                    className={BUTTON_CLASSES.desktop}
                                    aria-label="Go back"
                                    title="Go back"
                                >
                                    <ChevronLeft className="w-4 h-4 stroke-themeblue1" />
                                    <span className="hidden lg:inline text-[10pt] text-primary/60 ml-2">
                                        Back
                                    </span>
                                </button>
                            )}
                            <button
                                onClick={onMedicationClick}
                                className={BUTTON_CLASSES.desktop}
                                aria-label={medicationButtonText}
                                title={medicationButtonText}
                            >
                                <svg className="w-4 h-4 stroke-themeblue1 fill-transparent" viewBox="0 0 14 14">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M6.59 1.69a4.045 4.045 0 1 1 5.72 5.72l-4.9 4.9a4.045 4.045 0 1 1-5.72-5.72zm-2.2 2.2l5.72 5.72" />
                                </svg>
                                <span className="hidden lg:inline text-[10pt] text-tertiary ml-2">
                                    {medicationButtonText}
                                </span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Title - Centered on mobile, hidden on desktop */}
            {isMobile && !isSearchExpanded && (
                <div className="flex-1 min-w-0 px-2 transition-opacity duration-300">
                    <div className="truncate whitespace-nowrap text-center">
                        {showDynamicTitle && dynamicTitle ? (
                            <span className="text-[9pt] text-primary font-normal">{dynamicTitle}</span>
                        ) : (
                            <span className="text-[9pt] text-primary font-normal">ADTMC 3.5</span>
                        )}
                    </div>
                </div>
            )}

            {/* Search Container - shrink-0 on mobile (flex-1 when expanded), flex-1 on desktop */}
            <div className={`flex items-center min-w-0 ${isMobile
                    ? (isSearchExpanded ? 'flex-1' : 'shrink-0 justify-end')
                    : 'flex-1 justify-center'
                }`}>
                {/* Mobile expanded search */}
                {isMobile && isSearchExpanded && (
                    <div
                        className={`flex items-center justify-center transition-all duration-300 bg-themewhite text-tertiary rounded-full border border-themeblue3/10 shadow-xs focus-within:border-themeblue1/30 focus-within:bg-themewhite2 w-full animate-expandSearch`}
                    >
                        <input
                            ref={inputRef}
                            type="search"
                            placeholder="search"
                            value={searchInput}
                            onChange={(e) => onSearchChange(e.target.value)}
                            onFocus={handleSearchFocus}
                            onBlur={handleSearchBlur}
                            className="text-tertiary bg-transparent outline-none text-[16px] w-full px-4 py-2 rounded-l-full min-w-0"
                        />

                        <div
                            className="flex items-center justify-center px-2 py-2 bg-themewhite2 stroke-themeblue3 rounded-r-full cursor-pointer transition-all duration-300 hover:bg-themewhite shrink-0"
                            onClick={() => handleClearSearch(!hasSearchInput)}
                        >
                            <X className="w-5 h-5 stroke-themeblue1" />
                        </div>
                    </div>
                )}

                {/* Desktop search (always visible) */}
                {!isMobile && (
                    <div
                        className={`flex items-center justify-center transition-all duration-300 bg-themewhite text-tertiary rounded-full border border-themeblue3/10 shadow-xs focus-within:border-themeblue1/30 focus-within:bg-themewhite2 w-full max-w-130`}
                    >
                        <input
                            ref={inputRef}
                            type="search"
                            placeholder="search"
                            value={searchInput}
                            onChange={(e) => onSearchChange(e.target.value)}
                            onFocus={handleSearchFocus}
                            onBlur={handleSearchBlur}
                            className="text-tertiary bg-transparent outline-none text-[16px] w-full px-4 py-2 rounded-l-full min-w-0"
                        />

                        <div
                            className="flex items-center justify-center px-2 py-2 bg-themewhite2 stroke-themeblue3 rounded-r-full cursor-pointer transition-all duration-300 hover:bg-themewhite shrink-0"
                            onClick={hasSearchInput ? () => handleClearSearch(false) : undefined}
                        >
                            {hasSearchInput ? (
                                <X className="w-5 h-5 stroke-themeblue1" />
                            ) : (
                                <Search className="w-5 h-5 stroke-themeblue1 opacity-50" />
                            )}
                        </div>
                    </div>
                )}

                {isMobile && !isSearchExpanded && (
                    <div className="flex items-center justify-end h-full">
                        {/* Container with border - wider for better mobile feel */}
                        <div className="rounded-full bg-transparent border border-tertiary/20 flex items-center justify-center p-0.5">
                            {/* Info button wrapper that animates width and opacity */}
                            <div className={`
                transition-all duration-300 ease-out overflow-hidden
                ${shouldShowInfoButton ? 'w-10 opacity-100' : 'w-0 opacity-0'}
                flex items-center justify-center
            `}>
                                {shouldShowInfoButton && (
                                    <button
                                        onClick={onInfoClick}
                                        className="text-tertiary hover:text-primary transition-all duration-200"
                                        aria-label="Info"
                                        title="Info"
                                    >
                                        {/* No border on inner div since container has it */}
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center">
                                            <Info className="w-5 h-5 stroke-current" />
                                        </div>
                                    </button>
                                )}
                            </div>

                            {/* Search button - always present */}
                            <button
                                onClick={handleMobileSearchClick}
                                className="text-tertiary hover:text-primary transition-all duration-200"
                                aria-label="Search"
                                title="Search"
                            >
                                {/* No border on inner div since container has it */}
                                <div className="w-10 h-10 rounded-full flex items-center justify-center">
                                    <Search className="w-5 h-5 stroke-current" />
                                </div>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Right container - Desktop only buttons (Import, Settings) */}
            {!isMobile && (
                <div className="flex items-center justify-center transition-all duration-300 w-max opacity-100">
                    <div className="w-max h-full flex items-center justify-center gap-2">
                        {/* Import button - with text on large screens */}
                        <button
                            onClick={onImportClick}
                            className={BUTTON_CLASSES.desktop}
                            aria-label="Import note"
                            title="Import note"
                        >
                            <Upload className="w-4 h-4 stroke-themeblue1" />
                            <span className="hidden lg:inline text-[10pt] text-tertiary ml-2">
                                Import Note
                            </span>
                        </button>

                        {/* Settings button - with text on large screens */}
                        {onSettingsClick && (
                            <button
                                onClick={onSettingsClick}
                                className={BUTTON_CLASSES.desktop}
                                aria-label="Settings"
                                title="Settings"
                            >
                                <Settings className="w-4 h-4 stroke-themeblue1" />
                                <span className="hidden lg:inline text-[10pt] text-tertiary ml-2">
                                    Settings
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}