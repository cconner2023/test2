// NavTop.tsx - Simplified version with grouped props
import { X, ChevronLeft, Info, Mail, Upload, BookOpen, CheckCircle, Camera, ImagePlus } from "lucide-react";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSpring, animated, to } from '@react-spring/web';
import type { NavTopProps } from "../Types/NavTopTypes";
import { useAvatar } from "../Utilities/AvatarContext";
import { useAuth } from "../Hooks/useAuth";
import { useMessagesContext } from "../Hooks/MessagesContext";
import { getInitials } from "../Utilities/nameUtils";

export function NavTop({ search, import: importProps, actions, ui }: NavTopProps) {
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
        onKnowledgeBaseClick,
        onInfoClick,
        onMessagesClick,
    } = actions

    const {
        showBack = false,
        dynamicTitle,
        isMobile,
        isAlgorithmView = false,
    } = ui

    // Refs and computed values
    const internalInputRef = useRef<HTMLInputElement>(null);
    const inputRef = searchInputRef || internalInputRef;
    const hasSearchInput = searchInput.trim().length > 0;

    // Mobile-specific UI flags
    const shouldShowMessagesButton = isMobile && isAuthenticated && !isSearchExpanded;
    const shouldShowInfoButton = isMobile && isAlgorithmView && !isSearchExpanded;

    // Avatar button spring: hidden when navigated to detail (showBack)
    const avatarSpring = useSpring({
        opacity: showBack ? 0 : 1,
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

    // Import expansion props
    const {
        isImportExpanded = false,
        onImportExpandToggle,
        onImportSubmit,
        onImportScan,
        onImportImage,
        importError,
    } = importProps ?? {};

    const importInputRef = useRef<HTMLInputElement>(null);
    const [importText, setImportText] = useState('');

    // Either search or import can be expanded (mutually exclusive via store)
    const isAnyExpanded = isSearchExpanded || isImportExpanded;

    // Desktop import spring
    const desktopImportSpring = useSpring({
        overlayOpacity: isImportExpanded ? 1 : 0,
        overlayScale: isImportExpanded ? 1 : 0.97,
        config: { tension: 260, friction: 26 },
    });

    // Focus input when mobile search expands
    useEffect(() => {
        if (isSearchExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isSearchExpanded, inputRef]);

    // Focus import input when it expands
    useEffect(() => {
        if (isImportExpanded && importInputRef.current) {
            importInputRef.current.focus();
        }
    }, [isImportExpanded]);

    // Clear import text when collapsing
    useEffect(() => {
        if (!isImportExpanded) setImportText('');
    }, [isImportExpanded]);

    const handleImportSubmit = useCallback(() => {
        const text = importText.trim();
        if (!text) return;
        onImportSubmit?.(text);
        setImportText('');
    }, [importText, onImportSubmit]);

    const handleImportCollapse = useCallback(() => {
        setImportText('');
        onImportExpandToggle?.();
    }, [onImportExpandToggle]);

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
        desktop: "h-8 flex items-center justify-center px-3 lg:px-4 py-1.5 bg-themewhite2 hover:bg-themewhite rounded-full active:scale-95 transition-all duration-300"
    };

    return (
        <div className={`flex items-center h-full w-full px-2 md:pl-4 transition-all duration-300 md:bg-themewhite bg-transparent relative`}>
            {/* Left section: buttons - hidden when mobile search is expanded */}
            {(!isMobile || !isAnyExpanded) && (
                <div className="flex items-center shrink-0">
                    {/* Mobile: Back + Avatar button crossfade */}
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
                                        className={`${BUTTON_CLASSES.mobileButton} active:scale-95`}
                                        aria-label="Go back"
                                        title="Go back"
                                    >
                                        <ChevronLeft className="w-6 h-6 stroke-current" />
                                    </button>
                                </div>
                            </animated.div>

                            {/* Avatar button — opens SideNav */}
                            <animated.div
                                className="absolute top-0.5 left-1"
                                style={{
                                    opacity: avatarSpring.opacity,
                                    pointerEvents: showBack ? 'none' : 'auto',
                                }}
                            >
                                <div className={BUTTON_CLASSES.mobileContainer}>
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
                                </div>
                            </animated.div>
                        </div>
                    )}

                    {/* Desktop: Avatar (opens SideNav) + Back + KB */}
                    {!isMobile && (
                        <div className="flex justify-center items-center shrink-0 gap-2">
                            {/* Avatar — opens SideNav */}
                            <button
                                onClick={onMenuClick}
                                className="w-8 h-8 rounded-full overflow-hidden shrink-0 active:scale-95 transition-transform"
                                aria-label="Open menu"
                                title="Menu"
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
                        </div>
                    )}
                </div>
            )}

            {/* Title - Centered on mobile, hidden on desktop */}
            {isMobile && !isAnyExpanded && (
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
                <div className={`flex items-center min-w-0 ${isAnyExpanded ? 'flex-1' : 'shrink-0 justify-end'}`}>
                    {/* Mobile import input */}
                    {isImportExpanded && (
                        <div className="relative w-full animate-expandSearch">
                            <form
                                onSubmit={(e) => { e.preventDefault(); handleImportSubmit(); }}
                                className={`flex items-center w-full rounded-full border shadow-xs bg-themewhite ${
                                    importError
                                        ? 'border-themeredred/30'
                                        : 'border-themeblue3/10 focus-within:border-themeblue1/30 focus-within:bg-themewhite2'
                                }`}
                            >
                                <div className="flex items-center gap-0.5 pl-2 shrink-0 text-tertiary/40">
                                    <button
                                        type="button"
                                        onClick={() => { handleImportCollapse(); onImportScan?.(); }}
                                        className="p-1.5 hover:text-themeblue3 active:scale-95 transition-colors"
                                        title="Scan barcode"
                                    >
                                        <Camera size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { handleImportCollapse(); onImportImage?.(); }}
                                        className="p-1.5 hover:text-themeblue3 active:scale-95 transition-colors"
                                        title="Upload image"
                                    >
                                        <ImagePlus size={16} />
                                    </button>
                                </div>
                                <input
                                    ref={importInputRef}
                                    type="text"
                                    placeholder="Paste barcode code"
                                    value={importText}
                                    onChange={(e) => setImportText(e.target.value)}
                                    className="text-tertiary bg-transparent outline-none text-[16px] w-full px-3 py-2 min-w-0"
                                />
                                <div className="flex items-center shrink-0 pr-1">
                                    {importText ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setImportText('')}
                                                className="p-1 text-tertiary/40 hover:text-tertiary active:scale-95 transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                            <button
                                                type="submit"
                                                className="p-1 text-themeblue3 hover:text-themeblue3/80 active:scale-95 transition-colors"
                                                title="Decode"
                                            >
                                                <CheckCircle size={22} />
                                            </button>
                                        </>
                                    ) : (
                                        <div
                                            className="flex items-center justify-center px-2 py-2 bg-themewhite2 rounded-r-full cursor-pointer active:scale-95 transition-all duration-300 hover:bg-themewhite shrink-0"
                                            onClick={handleImportCollapse}
                                        >
                                            <X className="w-5 h-5 stroke-themeblue1" />
                                        </div>
                                    )}
                                </div>
                            </form>
                            <div className={`absolute left-0 right-0 top-full mt-1.5 transition-all duration-300 ease-out ${
                                importError ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
                            }`}>
                                <p className="text-xs font-medium text-themeredred bg-themeredred/5 rounded-full px-4 py-1.5 text-center">
                                    {importError}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Mobile collapsed: messages + info + search buttons */}
                    {!isAnyExpanded && (
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
                                            className="text-tertiary hover:text-primary active:scale-95 transition-all duration-200 relative"
                                            aria-label="Messages"
                                            title="Messages"
                                        >
                                            <div className="w-11 h-11 rounded-full flex items-center justify-center">
                                                <Mail className="w-6 h-6 stroke-current" />
                                                {totalUnread > 0 && (
                                                    <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-themeredred text-white text-[10px] font-bold leading-none">
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
                                            className="text-tertiary hover:text-primary active:scale-95 transition-all duration-200"
                                            aria-label="Info"
                                            title="Info"
                                        >
                                            <div className="w-11 h-11 rounded-full flex items-center justify-center">
                                                <Info className="w-6 h-6 stroke-current" />
                                            </div>
                                        </button>
                                    )}
                                </div>

                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Desktop: Search + Import + Messages — wrapped so import overlay covers search area */}
            {!isMobile && (
                <div className="flex-1 min-w-0 flex items-center gap-2 ml-4 mr-2 relative">
                    {/* Persistent search input */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center w-full rounded-full border border-themeblue3/20 shadow-xs focus-within:border-themeblue1/40 focus-within:bg-themewhite2 bg-themewhite transition-all duration-300">
                            <input
                                ref={inputRef}
                                type="search"
                                placeholder="Search"
                                value={searchInput}
                                onChange={(e) => onSearchChange(e.target.value)}
                                onFocus={handleSearchFocus}
                                className="text-tertiary bg-transparent outline-none text-sm w-full px-4 py-1.5 rounded-l-full min-w-0 [&::-webkit-search-cancel-button]:hidden"
                            />
                            {hasSearchInput && (
                                <div
                                    className="flex items-center justify-center pr-2 cursor-pointer shrink-0 active:scale-95 transition-transform"
                                    onClick={() => handleClearSearch(false)}
                                >
                                    <X className="w-4 h-4 stroke-tertiary/50 hover:stroke-tertiary" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Import button */}
                    <button
                        onClick={onImportExpandToggle}
                        className={`${BUTTON_CLASSES.desktop} shrink-0`}
                        aria-label="Import note"
                        title="Import note"
                    >
                        <Upload className="w-4 h-4 stroke-themeblue1" />
                        <span className="hidden lg:inline text-[10pt] text-tertiary ml-2">
                            Import
                        </span>
                    </button>

                    {/* Messages — gated on auth, with unread badge */}
                    {isAuthenticated && (
                        <button
                            onClick={onMessagesClick}
                            className={`${BUTTON_CLASSES.desktop} relative shrink-0`}
                            aria-label="Messages"
                            title="Messages"
                        >
                            <Mail className="w-4 h-4 stroke-themeblue1" />
                            {totalUnread > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-themeredred text-white text-[10px] font-bold leading-none">
                                    {totalUnread > 99 ? '99+' : totalUnread}
                                </span>
                            )}
                        </button>
                    )}

                    {/* Import overlay — covers search + buttons */}
                    <animated.div
                        className="absolute inset-0 z-10 flex items-center bg-themewhite"
                        style={{
                            opacity: desktopImportSpring.overlayOpacity,
                            transform: desktopImportSpring.overlayScale.to(s => `scale(${s})`),
                            pointerEvents: isImportExpanded ? 'auto' : 'none',
                        }}
                    >
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleImportSubmit(); }}
                            className="flex items-center w-full rounded-full border border-themeblue3/20 shadow-xs focus-within:border-themeblue1/40 focus-within:bg-themewhite2 bg-themewhite transition-all duration-300"
                        >
                            <div className="flex items-center gap-0.5 pl-2 shrink-0 text-tertiary/40">
                                <button
                                    type="button"
                                    onClick={() => { handleImportCollapse(); onImportScan?.(); }}
                                    className="p-1.5 hover:text-themeblue3 active:scale-95 transition-colors"
                                    title="Scan barcode"
                                >
                                    <Camera size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { handleImportCollapse(); onImportImage?.(); }}
                                    className="p-1.5 hover:text-themeblue3 active:scale-95 transition-colors"
                                    title="Upload image"
                                >
                                    <ImagePlus size={16} />
                                </button>
                            </div>
                            <input
                                ref={importInputRef}
                                type="text"
                                placeholder="Paste barcode code"
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                                className="text-tertiary bg-transparent outline-none text-[16px] w-full px-3 py-2 min-w-0"
                            />
                            <div className="flex items-center shrink-0 pr-1">
                                {importText ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setImportText('')}
                                            className="p-1 text-tertiary/40 hover:text-tertiary active:scale-95 transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                        <button
                                            type="submit"
                                            className="p-1 text-themeblue3 hover:text-themeblue3/80 active:scale-95 transition-colors"
                                            title="Decode"
                                        >
                                            <CheckCircle size={22} />
                                        </button>
                                    </>
                                ) : (
                                    <div
                                        className="flex items-center justify-center px-2 py-2 bg-themewhite2 rounded-r-full cursor-pointer active:scale-95 transition-all duration-300 hover:bg-themewhite shrink-0"
                                        onClick={handleImportCollapse}
                                    >
                                        <X className="w-5 h-5 stroke-themeblue1" />
                                    </div>
                                )}
                            </div>
                        </form>
                    </animated.div>
                </div>
            )}
        </div>
    );
}
