// NavTop.tsx - Simplified approach with conditional info button in search container
import { Search, X, Menu, ChevronLeft, Upload, Moon, Sun, Info, List, Settings } from "lucide-react";
import { useRef, useEffect } from "react";
import { useTheme } from "../Utilities/ThemeContext";
export type MobileViewState = 'visible' | 'hidden'

interface NavTopProps {
    searchInput: string;
    onSearchChange: (value: string) => void;
    onSearchFocus?: () => void;
    onSearchClear?: () => void;
    showMenu?: boolean;
    showBack?: boolean;
    onMenuClick?: () => void;
    onBackClick?: () => void;
    onImportClick?: () => void;
    onMedicationClick?: () => void;
    onSettingsClick?: () => void; // NEW PROP
    dynamicTitle?: string;
    showDynamicTitle?: boolean;
    searchInputRef?: React.RefObject<HTMLInputElement>;
    showMedicationList?: boolean;
    medicationButtonText?: string;
    isMobile: boolean;
    isSearchExpanded?: boolean;
    onSearchExpandToggle?: () => void;
}

export function NavTop({
    searchInput,
    onSearchChange,
    onSearchFocus,
    onSearchClear,
    showMenu = false,
    showBack = false,
    onMenuClick,
    onBackClick,
    onImportClick,
    onMedicationClick,
    onSettingsClick, // NEW PROP
    dynamicTitle,
    showDynamicTitle = false,
    searchInputRef,
    medicationButtonText = "Medications",
    isMobile,
    isSearchExpanded = false,
    onSearchExpandToggle,
}: NavTopProps) {
    const hasSearchInput = searchInput.trim().length > 0;
    const internalInputRef = useRef<HTMLInputElement>(null);
    const inputRef = searchInputRef || internalInputRef;
    const { toggleTheme, theme } = useTheme();

    // Determine if we should show info button next to search in mobile
    const shouldShowInfoWithSearch = isMobile && showBack && showDynamicTitle && !isSearchExpanded;

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

    // Handle clear search
    const handleClearSearch = () => {
        onSearchChange("");
        onSearchClear?.();
        inputRef.current?.focus();
    };

    // Handle mobile search collapse
    const handleMobileSearchCollapse = () => {
        onSearchChange("");
        onSearchClear?.();
        if (onSearchExpandToggle) {
            onSearchExpandToggle();
        }
    };

    // Determine search icon behavior
    const getSearchIconBehavior = () => {
        if (isMobile) {
            if (isSearchExpanded) {
                return hasSearchInput ? 'clear' : 'collapse';
            }
            return 'expand';
        } else {
            return hasSearchInput ? 'clear' : 'default';
        }
    };

    const searchIconBehavior = getSearchIconBehavior();
    const mobileButtonClass = "p-2 text-tertiary hover:text-primary justify-center items-center transition-colors";
    const mobileButtonInnerClass = "w-8 h-8 rounded-full backdrop-blur-md shadow-md shadow-themewhite2 bg-themewhite/20 border border-tertiary/30 flex items-center justify-center";
    const desktopButtonClass = "h-8 flex items-center justify-center px-3 lg:px-4 py-1.5 bg-themewhite2 hover:bg-themewhite rounded-full transition-all duration-300";

    // Determine if menu button should be shown
    const shouldShowMenuButton = showMenu && (isMobile || !showBack);

    return (
        <div className="flex items-center h-full w-full px-3 bg-themewhite transition-all duration-300">
            {/* Left section: buttons and title */}
            <div className="flex items-center gap-2 min-w-0">
                {/* Menu/Back button */}
                <div className="flex justify-center items-center space-x-2 shrink-0">
                    {/* Back Button */}
                    {showBack && (
                        <button
                            onClick={onBackClick}
                            className={isMobile ? mobileButtonClass : desktopButtonClass}
                            aria-label="Go back"
                            title="Go back"
                        >
                            {isMobile ? (
                                <div className={mobileButtonInnerClass}>
                                    <ChevronLeft className="w-5 h-5 stroke-current" />
                                </div>
                            ) : (
                                <>
                                    <ChevronLeft className="w-4 h-4 stroke-themeblue1" />
                                    <span className="hidden lg:inline text-[10pt] text-primary/60 ml-2">
                                        Back
                                    </span>
                                </>
                            )}
                        </button>
                    )}

                    {/* Menu Button - shows on mobile when not showing back, hidden on desktop */}
                    {shouldShowMenuButton && (
                        <button
                            onClick={onMenuClick}
                            className={`${isMobile ? mobileButtonClass : 'hidden'} ${!isMobile ? desktopButtonClass : ''}`}
                            aria-label="Open menu"
                            title="Open menu"
                        >
                            {isMobile ? (
                                <div className={mobileButtonInnerClass}>
                                    <Menu className="w-5 h-5 stroke-current" />
                                </div>
                            ) : (
                                <>
                                    <Menu className="w-4 h-4 stroke-themeblue1" />
                                    <span className="hidden lg:inline text-[10pt] text-tertiary ml-2">
                                        Home
                                    </span>
                                </>
                            )}
                        </button>
                    )}

                    {/* Medications/ADTMC button - only on desktop, hidden on mobile */}
                    {!isMobile && (
                        <button
                            onClick={onMedicationClick}
                            className={desktopButtonClass}
                            aria-label={medicationButtonText}
                            title={medicationButtonText}
                        >
                            {medicationButtonText === "ADTMC" ? (
                                <List className="w-4 h-4 stroke-themeblue1" />
                            ) : (
                                <svg className="w-4 h-4 stroke-themeblue1 fill-transparent" viewBox="0 0 14 14">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M6.59 1.69a4.045 4.045 0 1 1 5.72 5.72l-4.9 4.9a4.045 4.045 0 1 1-5.72-5.72zm-2.2 2.2l5.72 5.72" />
                                </svg>
                            )}
                            <span className="hidden lg:inline text-[10pt] text-tertiary ml-2">
                                {medicationButtonText}
                            </span>
                        </button>
                    )}
                </div>

                {/* Title - Hide when mobile search is expanded */}
                {(!isMobile || !isSearchExpanded) && (
                    <div className={`truncate whitespace-nowrap transition-opacity duration-300 min-w-0 flex-1 ${isSearchExpanded ? 'opacity-0' : 'opacity-100'}`}>
                        <span className={isMobile ? "md:hidden" : ""}>
                            {showDynamicTitle && dynamicTitle ? (
                                <span className="text-[9pt] md:hidden block text-primary font-normal shrink truncate">{dynamicTitle}</span>
                            ) : (
                                <span className="text-[9pt] md:hidden block text-primary font-normal shrink truncate">ADTMC 3.5</span>
                            )}
                        </span>
                    </div>
                )}
            </div>

            {/* Search Container - Now also contains info button when appropriate */}
            <div className="flex items-center justify-end md:justify-center flex-1 min-w-0">
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
                            onClick={() => {
                                if (searchIconBehavior === 'clear') {
                                    handleClearSearch();
                                } else if (searchIconBehavior === 'collapse') {
                                    handleMobileSearchCollapse();
                                }
                            }}
                        >
                            {searchIconBehavior === 'clear' ? (
                                <X className="w-5 h-5 stroke-themeblue1" />
                            ) : (
                                <X className="w-5 h-5 stroke-themeblue1" />
                            )}
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
                            onClick={() => {
                                if (searchIconBehavior === 'clear') {
                                    handleClearSearch();
                                }
                            }}
                        >
                            {searchIconBehavior === 'clear' ? (
                                <X className="w-5 h-5 stroke-themeblue1" />
                            ) : (
                                <Search className="w-5 h-5 stroke-themeblue1 opacity-50" />
                            )}
                        </div>
                    </div>
                )}

                {isMobile && !isSearchExpanded && (
                    <div className="flex items-center justify-end h-full">
                        {/* Container acts as the "button with border" - has p-2 like individual buttons would */}
                        <div className="rounded-full bg-transparent border border-tertiary/20 flex items-center justify-center p-0.5">
                            {/* Info button wrapper that animates width */}
                            <div className={`
                transition-all duration-200 ease-out
                ${shouldShowInfoWithSearch ? 'w-8 opacity-100' : 'w-0 opacity-0'}
                flex items-center justify-center
            `}>
                                {shouldShowInfoWithSearch && (
                                    <button
                                        onClick={() => { }}
                                        className="text-tertiary hover:text-primary transition-colors"
                                        aria-label="Info"
                                        title="Info"
                                    >
                                        {/* No border on inner div since container has it */}
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center">
                                            <Info className="w-5 h-5 stroke-current" />
                                        </div>
                                    </button>
                                )}
                            </div>

                            {/* Search button - always present */}
                            <button
                                onClick={handleMobileSearchClick}
                                className="text-tertiary hover:text-primary transition-colors"
                                aria-label="Search"
                                title="Search"
                            >
                                {/* No border on inner div since container has it */}
                                <div className="w-8 h-8 rounded-full flex items-center justify-center">
                                    <Search className="w-5 h-5 stroke-current" />
                                </div>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Right container - Desktop only buttons (Import, Theme, Settings) */}
            {!isMobile && (
                <div className="flex items-center justify-center transition-all duration-300 w-max opacity-100">
                    <div className="w-max h-full flex items-center justify-center gap-2">
                        {/* Import button - with text on large screens */}
                        <button
                            onClick={onImportClick}
                            className={desktopButtonClass}
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
                                className={desktopButtonClass}
                                aria-label="Settings"
                                title="Settings"
                            >
                                <Settings className="w-4 h-4 stroke-themeblue1" />
                                <span className="hidden lg:inline text-[10pt] text-tertiary ml-2">
                                    Settings
                                </span>
                            </button>
                        )}

                        {/* Theme toggle - with text on large screens */}
                        <button
                            onClick={toggleTheme}
                            className={desktopButtonClass}
                            aria-label="Toggle theme"
                            title="Toggle theme"
                        >
                            {theme === 'light' ? (
                                <Moon className="w-4 h-4 stroke-themeblue1" />
                            ) : (
                                <Sun className="w-4 h-4 stroke-themeblue1" />
                            )}
                            <span className="hidden lg:inline text-[10pt] text-tertiary ml-2">
                                {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                            </span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}