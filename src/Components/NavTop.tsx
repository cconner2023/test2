// NavTop.tsx - Simplified version with grouped props
import { Search, X, Menu, ChevronLeft, Upload, Info, Settings, HelpCircle, BookOpen, Mail, Package } from "lucide-react";
import { useRef, useEffect, useMemo } from "react";
import { useSpring, useTrail, animated, to } from '@react-spring/web';
import type { NavTopProps } from "../Types/NavTopTypes";
import { useAvatar } from "../Utilities/AvatarContext";
import { useAuth } from "../Hooks/useAuth";
import { useMessagesContext } from "../Hooks/MessagesContext";
import { getInitials } from "../Utilities/nameUtils";
import { createLogger } from "../Utilities/Logger";
import { PROPERTY_MANAGEMENT_ENABLED } from "../lib/featureFlags";

const logger = createLogger('NavTop');
import { menuData as allMenuData } from "../Data/CatData";

// Icon map for menu items
const iconMap: Record<string, React.ReactNode> = {
    'import': <Upload size={16} className="text-primary/70" />,
    'knowledgebase': <BookOpen size={16} className="text-primary/70" />,
    'messages': <Mail size={16} className="text-primary/70" />,
    'property': <Package size={16} className="text-primary/70" />,
    'settings': <Settings size={16} className="text-primary/70" />,
};

export function NavTop({ search, actions, ui }: NavTopProps) {
    const { currentAvatar, customImage, isCustom, isInitials } = useAvatar()
    const { profile, isAuthenticated } = useAuth()
    const messagesCtx = useMessagesContext()
    const totalUnread = useMemo(() => {
        if (!messagesCtx) return 0
        return Object.values(messagesCtx.unreadCounts).reduce((sum, n) => sum + n, 0)
    }, [messagesCtx?.unreadCounts])

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
        onKnowledgeBaseClick,
        onSettingsClick,
        onInfoClick,
        onMessagesClick,
        onPropertyClick,
    } = actions

    const {
        showBack = false,
        dynamicTitle,
        isMobile,
        isAlgorithmView = false,
        isMenuOpen = false,
    } = ui

    const menuData = useMemo(() => allMenuData.filter(item => {
        if (!item.gateKey) return true
        if (item.gateKey === 'authenticated') return isAuthenticated
        if (item.gateKey === 'property') return isAuthenticated && PROPERTY_MANAGEMENT_ENABLED
        return true
    }), [isAuthenticated]);

    // Refs and computed values
    const internalInputRef = useRef<HTMLInputElement>(null);
    const inputRef = searchInputRef || internalInputRef;
    const hasSearchInput = searchInput.trim().length > 0;

    // Mobile-specific UI flags
    const shouldShowMessagesButton = isMobile && isAuthenticated && !isSearchExpanded;
    const shouldShowInfoButton = isMobile && isAlgorithmView && !isSearchExpanded;
    // Menu spring: container expansion
    const containerSpring = useSpring({
        width: isMenuOpen ? 224 : 48,
        height: isMenuOpen ? menuData.length * 48 + 24 : 48,
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

    // Desktop search spring: animates spacer / container flex + overlay reveal
    const desktopSearchSpring = useSpring({
        spacerFlex: isSearchExpanded ? 0 : 1,
        containerFlex: isSearchExpanded ? 1 : 0,
        overlayOpacity: isSearchExpanded ? 1 : 0,
        overlayScale: isSearchExpanded ? 1 : 0.97,
        buttonsOpacity: isSearchExpanded ? 0 : 1,
        config: { tension: 260, friction: 26 },
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
        switch (action) {
            case 'import':
                onImportClick?.();
                break;
            case 'knowledgebase':
                onKnowledgeBaseClick?.();
                break;
            case 'messages':
                onMessagesClick?.();
                break;
            case 'property':
                onPropertyClick?.();
                break;
            case 'settings':
                onSettingsClick?.();
                break;
            default:
                logger.warn("Unknown menu action:", action);
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
        if (!isSearchExpanded && onSearchExpandToggle) {
            onSearchExpandToggle();
        }
        onSearchFocus?.();
    };

    // Handle search input blur
    const handleSearchBlur = () => {
        if (!hasSearchInput && isSearchExpanded) {
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
        mobileButton: "w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary transition-all duration-200",
        desktop: "h-8 flex items-center justify-center px-3 lg:px-4 py-1.5 bg-themewhite2 hover:bg-themewhite rounded-full transition-all duration-300"
    };

    return (
        <div className={`flex items-center h-full w-full px-2 md:pl-4 transition-all duration-300 md:bg-themewhite bg-transparent`}>
            {/* Left section: buttons - hidden when mobile search is expanded */}
            {(!isMobile || !isSearchExpanded) && (
                <div className="flex items-center shrink-0">
                    {/* Mobile: Back + Menu button crossfade */}
                    {isMobile && (
                        <div className="relative">
                            {/* Invisible spacer to maintain navbar layout - 48px to match button */}
                            <div className="w-12 h-12" />

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
                                        <ChevronLeft className="w-6 h-6 stroke-current" />
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
                                    className="absolute top-0.5 left-0.5 w-11 h-11 flex items-center justify-center z-20"
                                    style={{
                                        opacity: buttonSpring.opacity,
                                        transform: to([buttonSpring.x, buttonSpring.scale], (x, s) => `translateX(${x}px) scale(${s})`),
                                        pointerEvents: (isMenuOpen || showBack) ? 'none' : 'auto',
                                    }}
                                >
                                    <button
                                        onClick={onMenuClick}
                                        className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform overflow-hidden"
                                        aria-label="Open menu"
                                    >
                                        {isCustom && customImage ? (
                                            <img
                                                src={customImage}
                                                alt="Profile"
                                                className="w-full h-full object-cover rounded-full"
                                            />
                                        ) : isInitials ? (
                                            <div className="w-full h-full rounded-full bg-themeblue2/15 flex items-center justify-center">
                                                <span className="text-sm font-semibold text-themeblue2">
                                                    {getInitials(profile.firstName, profile.lastName)}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="w-full h-full rounded-full overflow-hidden">
                                                {currentAvatar.svg}
                                            </div>
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
                                            <div className="mr-3 relative">
                                                {iconMap[menuData[index].action] || <HelpCircle size={16} className="text-primary/70" />}
                                                {menuData[index].badge && totalUnread > 0 && (
                                                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                                                        {totalUnread > 99 ? '99+' : totalUnread}
                                                    </span>
                                                )}
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

                    {/* Desktop buttons - avatar + back + medications + training + property */}
                    {!isMobile && (
                        <div className="flex justify-center items-center shrink-0 gap-2">
                            {/* Avatar — opens Settings */}
                            <button
                                onClick={onSettingsClick}
                                className="w-8 h-8 rounded-full overflow-hidden shrink-0 active:scale-95 transition-transform"
                                aria-label="Profile"
                                title="Settings"
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
                            {/* Knowledge Base */}
                            <button
                                onClick={onKnowledgeBaseClick}
                                className={BUTTON_CLASSES.desktop}
                                aria-label="Knowledge Base"
                                title="Knowledge Base"
                            >
                                <BookOpen className="w-4 h-4 stroke-themeblue1" />
                                <span className="hidden lg:inline text-[10pt] text-tertiary ml-2">
                                    Knowledge Base
                                </span>
                            </button>
                            {/* Property — gated on auth + feature flag */}
                            {isAuthenticated && PROPERTY_MANAGEMENT_ENABLED && (
                                <button
                                    onClick={onPropertyClick}
                                    className={BUTTON_CLASSES.desktop}
                                    aria-label="Property Book"
                                    title="Property Book"
                                >
                                    <Package className="w-4 h-4 stroke-themeblue1" />
                                    <span className="hidden lg:inline text-[10pt] text-tertiary ml-2">
                                        Property
                                    </span>
                                </button>
                            )}
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

            {/* Search Container - mobile only */}
            {isMobile && (
                <div className={`flex items-center min-w-0 ${isSearchExpanded ? 'flex-1' : 'shrink-0 justify-end'}`}>
                    {/* Mobile search input */}
                    {isSearchExpanded && (
                        <div className="flex items-center justify-center transition-all duration-300 bg-themewhite text-tertiary rounded-full border border-themeblue3/10 shadow-xs focus-within:border-themeblue1/30 focus-within:bg-themewhite2 w-full animate-expandSearch">
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

                    {/* Mobile collapsed: messages + info + search buttons */}
                    {!isSearchExpanded && (
                        <div className="flex items-center justify-end h-full">
                            <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center justify-center p-0.5">
                                <div className={`
                    transition-all duration-300 ease-out overflow-hidden
                    ${shouldShowMessagesButton ? 'w-11 opacity-100' : 'w-0 opacity-0'}
                    flex items-center justify-center
                `}>
                                    {shouldShowMessagesButton && (
                                        <button
                                            onClick={onMessagesClick}
                                            className="text-tertiary hover:text-primary transition-all duration-200 relative"
                                            aria-label="Messages"
                                            title="Messages"
                                        >
                                            <div className="w-11 h-11 rounded-full flex items-center justify-center">
                                                <Mail className="w-6 h-6 stroke-current" />
                                                {totalUnread > 0 && (
                                                    <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                                                        {totalUnread > 99 ? '99+' : totalUnread}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    )}
                                </div>

                                <div className={`
                    transition-all duration-300 ease-out overflow-hidden
                    ${shouldShowInfoButton ? 'w-11 opacity-100' : 'w-0 opacity-0'}
                    flex items-center justify-center
                `}>
                                    {shouldShowInfoButton && (
                                        <button
                                            onClick={onInfoClick}
                                            className="text-tertiary hover:text-primary transition-all duration-200"
                                            aria-label="Info"
                                            title="Info"
                                        >
                                            <div className="w-11 h-11 rounded-full flex items-center justify-center">
                                                <Info className="w-6 h-6 stroke-current" />
                                            </div>
                                        </button>
                                    )}
                                </div>

                                <button
                                    onClick={handleMobileSearchClick}
                                    className="text-tertiary hover:text-primary transition-all duration-200"
                                    aria-label="Search"
                                    title="Search"
                                >
                                    <div className="w-11 h-11 rounded-full flex items-center justify-center">
                                        <Search className="w-6 h-6 stroke-current" />
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Desktop spacer — spring-animated to collapse when search expands */}
            {!isMobile && (
                <animated.div className="min-w-0" style={{ flexGrow: desktopSearchSpring.spacerFlex }} />
            )}

            {/* Right container - Desktop only (Import, Messages, Search) */}
            {!isMobile && (
                <animated.div
                    className="relative flex items-center min-w-0 ml-3"
                    style={{ flexGrow: desktopSearchSpring.containerFlex, flexShrink: 0 }}
                >
                    {/* Buttons row — always laid out for stable width, fades out when search expands */}
                    <animated.div
                        className="flex items-center gap-2"
                        style={{ opacity: desktopSearchSpring.buttonsOpacity }}
                    >
                        {/* Import button */}
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

                        {/* Messages — icon only, gated on auth, with unread badge */}
                        {isAuthenticated && (
                            <button
                                onClick={onMessagesClick}
                                className={`${BUTTON_CLASSES.desktop} relative`}
                                aria-label="Messages"
                                title="Messages"
                            >
                                <Mail className="w-4 h-4 stroke-themeblue1" />
                                {totalUnread > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                                        {totalUnread > 99 ? '99+' : totalUnread}
                                    </span>
                                )}
                            </button>
                        )}

                        {/* Search toggle */}
                        <button
                            onClick={() => { onSearchExpandToggle?.(); onSearchFocus?.(); }}
                            className={BUTTON_CLASSES.desktop}
                            aria-label="Search"
                            title="Search"
                        >
                            <Search className="w-4 h-4 stroke-themeblue1" />
                        </button>
                    </animated.div>

                    {/* Search overlay — spring-animated over sibling buttons */}
                    <animated.div
                        className="absolute inset-0 z-10 flex items-center bg-themewhite"
                        style={{
                            opacity: desktopSearchSpring.overlayOpacity,
                            transform: desktopSearchSpring.overlayScale.to(s => `scale(${s})`),
                            pointerEvents: isSearchExpanded ? 'auto' : 'none',
                        }}
                    >
                        <div className="flex items-center w-full rounded-full border border-themeblue3/10 shadow-xs focus-within:border-themeblue1/30 focus-within:bg-themewhite2 bg-themewhite">
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
                    </animated.div>
                </animated.div>
            )}
        </div>
    );
}