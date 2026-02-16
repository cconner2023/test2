// NavTop.tsx - Simplified version with grouped props
import { Search, X, Menu, ChevronLeft, Upload, Info, Settings, Pill, HelpCircle } from "lucide-react";
import { useRef, useEffect } from "react";
import { useSpring, useTrail, animated, to } from '@react-spring/web';
import type { NavTopProps } from "../Types/NavTopTypes";
import { menuData } from "../Data/CatData";

// Icon map for menu items
const iconMap: Record<string, React.ReactNode> = {
    'import': <Upload size={16} className="text-primary/70" />,
    'medications': <Pill size={16} className="text-primary/70" />,
    'Settings': <Settings size={16} className="text-primary/70" />,
};

export function NavTop({ search, actions, ui }: NavTopProps) {
    // Destructure grouped props for cleaner usage
    const {
        searchInput,
        onSearchChange,
        onSearchFocus,
        onSearchClear,
        onSearchCollapse,
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
        dynamicTitle,
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
    // Menu spring: container expansion
    const containerSpring = useSpring({
        width: isMenuOpen ? 224 : 44,
        height: isMenuOpen ? menuData.length * 48 + 24 : 44,
        borderRadius: isMenuOpen ? 6 : 22,
        padTop: isMenuOpen ? 12 : 2,
        padBottom: isMenuOpen ? 12 : 2,
        padLeft: isMenuOpen ? 12 : 2,
        padRight: isMenuOpen ? 20 : 2,
        config: { tension: 220, friction: 26 },
    });

    // Menu button spring: hidden when menu open OR navigated to detail (showBack)
    const buttonSpring = useSpring({
        opacity: (isMenuOpen || showBack) ? 0 : 1,
        x: isMenuOpen ? 3 : showBack ? -3 : 0,
        scale: (isMenuOpen || showBack) ? 1.05 : 1,
        config: { tension: 220, friction: 26 },
    });

    // Back button spring: slides in from right when showBack, out to right when dismissed
    const backButtonSpring = useSpring({
        opacity: showBack ? 1 : 0,
        x: showBack ? 0 : 3,
        scale: showBack ? 1 : 1.05,
        config: { tension: 280, friction: 24 },
    });

    // Desktop back button spring: animates maxWidth to prevent layout push
    const desktopBackSpring = useSpring({
        maxWidth: showBack ? 150 : 0,
        opacity: showBack ? 1 : 0,
        scale: showBack ? 1 : 0.95,
        gap: showBack ? 8 : 0,
        config: { tension: 260, friction: 24 },
    });

    // Menu spring: staggered item reveal
    const menuItemTrail = useTrail(menuData.length, {
        opacity: isMenuOpen ? 1 : 0,
        y: isMenuOpen ? 0 : 8,
        config: { tension: 300, friction: 28 },
        delay: isMenuOpen ? 200 : 0,
    });

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
        if (isMobile && !hasSearchInput && isSearchExpanded) {
            onSearchCollapse?.();
        }
    };

    // Handle clear search - unified for both mobile and desktop
    const handleClearSearch = (shouldCollapse = false) => {
        onSearchChange("");
        onSearchClear?.();

        if (shouldCollapse) {
            onSearchCollapse?.();
        } else {
            inputRef.current?.focus();
        }
    };

    // Button style constants - iOS standard tap target is 44px (w-11 h-11)
    const BUTTON_CLASSES = {
        mobileContainer: "rounded-full border border-tertiary/20 flex items-center p-0.5 bg-themewhite",
        mobileButton: "w-10 h-10 rounded-full flex items-center justify-center text-tertiary hover:text-primary transition-all duration-200",
        desktop: "h-8 flex items-center justify-center px-3 lg:px-4 py-1.5 bg-themewhite2 hover:bg-themewhite rounded-full transition-all duration-300"
    };

    return (
        <div className={`flex items-center h-full w-full px-2 transition-all duration-300 md:bg-themewhite bg-transparent`}>
            {/* Left section: buttons - hidden when mobile search is expanded */}
            {(!isMobile || !isSearchExpanded) && (
                <div className="flex items-center shrink-0">
                    {/* Mobile: Back + Menu button crossfade */}
                    {isMobile && (
                        <div className="relative">
                            {/* Invisible spacer to maintain navbar layout - 44px to match button */}
                            <div className="w-11 h-11" />

                            {/* Back button - slides in from right, out to right */}
                            <animated.div
                                className="absolute top-0.5 left-1 z-40"
                                style={{
                                    opacity: backButtonSpring.opacity,
                                    transform: to([backButtonSpring.x, backButtonSpring.scale], (x, s) => `translateX(${x}px) scale(${s})`),
                                    pointerEvents: showBack ? 'auto' : 'none',
                                }}
                            >
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
                            </animated.div>

                            {/* Backdrop is rendered at App level to avoid overflow-hidden clipping */}

                            {/* Morphing container: button → menu panel */}
                            <animated.div
                                className="absolute top-0 left-1 z-50 transform-gpu overflow-hidden bg-themewhite"
                                style={{
                                    transformOrigin: 'top left',
                                    width: containerSpring.width,
                                    height: containerSpring.height,
                                    borderRadius: containerSpring.borderRadius,
                                    paddingTop: containerSpring.padTop,
                                    paddingBottom: containerSpring.padBottom,
                                    paddingLeft: containerSpring.padLeft,
                                    paddingRight: containerSpring.padRight,
                                    opacity: buttonSpring.opacity.to(o => isMenuOpen ? 1 : o),
                                    pointerEvents: (isMenuOpen || !showBack) ? 'auto' : 'none',
                                }}
                            >
                                {/* Border overlay - always visible */}
                                <div className="absolute inset-0 rounded-inherit pointer-events-none border border-tertiary/15" />
                                {/* Menu button - avatar on mobile, fades in with right-to-left slide */}
                                <animated.div
                                    className="absolute top-0.5 left-0.5 w-10 h-10 flex items-center justify-center z-20"
                                    style={{
                                        opacity: buttonSpring.opacity,
                                        transform: to([buttonSpring.x, buttonSpring.scale], (x, s) => `translateX(${x}px) scale(${s})`),
                                        pointerEvents: (isMenuOpen || showBack) ? 'none' : 'auto',
                                    }}
                                >
                                    <button
                                        onClick={onMenuClick}
                                        className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform overflow-hidden"
                                        aria-label="Open menu"
                                    >
                                        {ui.mobileAvatar ? (
                                            ui.mobileAvatar.isCustom && ui.mobileAvatar.customImage ? (
                                                <img
                                                    src={ui.mobileAvatar.customImage}
                                                    alt="Profile"
                                                    className="w-full h-full object-cover rounded-full"
                                                />
                                            ) : (
                                                <div className="w-full h-full rounded-full overflow-hidden">
                                                    {ui.mobileAvatar.avatarSvg}
                                                </div>
                                            )
                                        ) : (
                                            <Menu className="w-5 h-5 stroke-current" />
                                        )}
                                    </button>
                                </animated.div>

                                {/* Menu items: staggered spring reveal */}
                                <div className="relative z-10 space-y-0.5">
                                    {menuItemTrail.map((style, index) => (
                                        <animated.button
                                            key={index}
                                            onClick={() => handleMenuItemClick(menuData[index].action)}
                                            className="w-full text-left flex items-center pl-3 pr-4 py-3 rounded-xl cursor-pointer hover:bg-themewhite2/60 bg-transparent active:scale-[0.97] transform-gpu transition-colors"
                                            style={{
                                                opacity: style.opacity,
                                                transform: style.y.to(y => `translateY(${y}px)`),
                                            }}
                                        >
                                            <div className="mr-3">
                                                {iconMap[menuData[index].action] || <HelpCircle size={16} className="text-primary/70" />}
                                            </div>
                                            <span className="tracking-wide text-sm text-primary/80 font-medium">
                                                {menuData[index].text}
                                            </span>
                                        </animated.button>
                                    ))}
                                </div>
                            </animated.div>
                        </div>
                    )}

                    {/* Desktop buttons - no menu button */}
                    {!isMobile && (
                        <div className="flex justify-center items-center shrink-0">
                            <animated.div
                                className="overflow-hidden shrink-0"
                                style={{
                                    maxWidth: desktopBackSpring.maxWidth,
                                    marginRight: desktopBackSpring.gap,
                                    opacity: desktopBackSpring.opacity,
                                    transform: desktopBackSpring.scale.to(s => `scale(${s})`),
                                    pointerEvents: showBack ? 'auto' : 'none',
                                }}
                            >
                                <button
                                    onClick={onBackClick}
                                    className={`${BUTTON_CLASSES.desktop} whitespace-nowrap`}
                                    aria-label="Go back"
                                    title="Go back"
                                >
                                    <ChevronLeft className="w-4 h-4 stroke-themeblue1" />
                                    <span className="hidden lg:inline text-[10pt] text-primary/60 ml-2">
                                        Back
                                    </span>
                                </button>
                            </animated.div>
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
                        <span className="text-[9pt] text-primary font-normal">
                            {dynamicTitle || `ADTMC ${__APP_VERSION__}`}
                        </span>
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
                            className="text-tertiary bg-transparent outline-none text-[16px] w-full px-4 py-2 rounded-l-full min-w-0 [&::-webkit-search-cancel-button]:hidden"
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
                            className="text-tertiary bg-transparent outline-none text-[16px] w-full px-4 py-2 rounded-l-full min-w-0 [&::-webkit-search-cancel-button]:hidden"
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

            {/* Right container - Desktop only buttons (My Notes, Import, Settings) */}
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