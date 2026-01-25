// NavTop.tsx - Updated with correct icons and text visibility
import { SearchIcon, X } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { useTheme } from "../Utilities/ThemeContext";

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
    dynamicTitle?: string;
    showDynamicTitle?: boolean;
    searchInputRef?: React.RefObject<HTMLInputElement>;
    showMedicationList?: boolean;
    medicationButtonText?: string;
    isMobile: boolean; // Required from parent
    isSearchExpanded?: boolean; // For mobile search state
    onSearchExpandToggle?: () => void; // To toggle mobile search
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
    const [showRightButtons, setShowRightButtons] = useState(false);
    const [isOvalVisible, setIsOvalVisible] = useState(false);

    // Focus input when mobile search expands
    useEffect(() => {
        if (isSearchExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isSearchExpanded, inputRef]);

    // Handle showing/hiding right buttons based on state
    useEffect(() => {
        if (isMobile) {
            // Show right buttons when we have a title and back button
            // Hide when search is expanded (search takes over)
            const shouldShowOval = (showBack && showDynamicTitle) && !isSearchExpanded;
            setShowRightButtons(shouldShowOval);
            setIsOvalVisible(shouldShowOval);
        } else {
            // Always show right buttons on desktop
            setShowRightButtons(true);
            setIsOvalVisible(false);
        }
    }, [isMobile, showBack, showDynamicTitle, isSearchExpanded]);

    // Determine which icon to show for medication button
    const getMedicationIcon = () => {
        if (medicationButtonText === "ADTMC") {
            return (
                <svg
                    className="h-4 w-4 stroke-themeblue1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            );
        } else {
            return (
                <svg
                    className="h-4 w-4 stroke-themeblue1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 14 14"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M6.59 1.69a4.045 4.045 0 1 1 5.72 5.72l-4.9 4.9a4.045 4.045 0 1 1-5.72-5.72zm-2.2 2.2l5.72 5.72"
                    />
                </svg>
            );
        }
    };

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
        // Don't collapse on mobile if there's input
        if (isMobile && !hasSearchInput && isSearchExpanded && onSearchExpandToggle) {
            onSearchExpandToggle();
        }
    };

    // Handle clear search
    const handleClearSearch = () => {
        onSearchChange("");
        onSearchClear?.();

        if (isMobile && isSearchExpanded && onSearchExpandToggle) {
            // Don't collapse immediately, let user keep typing
            // Only collapse if they click X again
        } else {
            inputRef.current?.focus();
        }
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

    // Simple icon button component for consistent styling
    const IconButton = ({
        icon: Icon,
        onClick,
        label,
        className = "",
        showText = false,
        text = ""
    }: {
        icon: React.ElementType;
        onClick?: () => void;
        label: string;
        className?: string;
        showText?: boolean;
        text?: string;
    }) => (
        <button
            onClick={onClick}
            className={`flex items-center justify-center ${showText ? 'gap-2 px-3 py-1.5' : 'w-8 h-8'} rounded-full bg-themewhite2 hover:bg-themewhite transition-colors duration-200 ${className}`}
            aria-label={label}
        >
            <Icon className="h-4 w-4 stroke-themeblue1" />
            {showText && text && (
                <span className="hidden lg:inline text-[10pt] text-tertiary">
                    {text}
                </span>
            )}
        </button>
    );

    return (
        <div className="flex items-center h-full w-full px-4 gap-3 bg-themewhite transition-all duration-300">
            {/* Left section: buttons and title */}
            <div className="flex items-center gap-2 min-w-0">
                {/* Menu/Back button */}
                <div className="flex justify-center space-x-2 shrink-0">
                    {/* Back Button */}
                    {showBack && (
                        <button
                            onClick={onBackClick}
                            className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-themewhite2 hover:bg-themewhite transition-all duration-300 min-h-8"
                        >
                            <svg
                                className="h-4 w-4 stroke-themeblue1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span className="hidden lg:inline text-[10pt] text-primary/60">
                                Back
                            </span>
                        </button>
                    )}
                    {/* Menu Button (mobile only) */}
                    {showMenu && (
                        <button
                            onClick={onMenuClick}
                            className="md:hidden flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-themewhite2 hover:bg-themewhite transition-all duration-300 min-h-8"
                        >
                            <svg
                                className="h-4 w-4 stroke-themeblue1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            <span className="hidden lg:inline text-[10pt] text-tertiary">
                                Home
                            </span>
                        </button>
                    )}
                    {/* Desktop only medications/ADTMC button */}
                    {!isMobile && (
                        <button
                            onClick={onMedicationClick}
                            className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-themewhite2 hover:bg-themewhite transition-all duration-300 min-h-8"
                        >
                            {getMedicationIcon()}
                            <span className="hidden lg:inline text-[10pt] text-tertiary">
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

            {/* Search Container - Conditionally rendered */}
            {isMobile && !isSearchExpanded && !isOvalVisible ? (
                // Mobile search button (only when we don't have the oval)
                <div className="flex items-center justify-end md:justify-center flex-1 min-w-0">
                    <button
                        onClick={handleMobileSearchClick}
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-themewhite2 hover:bg-themewhite transition-colors duration-200"
                        aria-label="Search"
                    >
                        <SearchIcon className="h-5 w-5 stroke-themeblue1" />
                    </button>
                </div>
            ) : isSearchExpanded ? (
                // Mobile expanded search OR Desktop search
                <div className="flex items-center justify-end md:justify-center flex-1 min-w-0">
                    <div
                        className={`flex items-center justify-center transition-all duration-300 bg-themewhite text-tertiary rounded-full border border-themeblue3/10 shadow-xs focus-within:border-themeblue1/30 focus-within:bg-themewhite2 ${isMobile ? 'w-full animate-expandSearch' : 'w-full max-w-130'}`}
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
                                } else if (searchIconBehavior === 'expand') {
                                    handleMobileSearchClick();
                                }
                            }}
                        >
                            {searchIconBehavior === 'clear' ? (
                                <X className="h-5 w-5 stroke-themeblue1" />
                            ) : searchIconBehavior === 'collapse' ? (
                                <X className="h-5 w-5 stroke-themeblue1" />
                            ) : (
                                <SearchIcon className="h-5 w-5 stroke-themeblue1 opacity-50" />
                            )}
                        </div>
                    </div>
                </div>
            ) : !isMobile ? (
                // Desktop search (always visible)
                <div className="flex items-center justify-end md:justify-center flex-1 min-w-0">
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
                                } else if (searchIconBehavior === 'expand') {
                                    handleMobileSearchClick();
                                }
                            }}
                        >
                            {searchIconBehavior === 'clear' ? (
                                <X className="h-5 w-5 stroke-themeblue1" />
                            ) : (
                                <SearchIcon className="h-5 w-5 stroke-themeblue1 opacity-50" />
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                // Empty spacer when oval is shown but search not expanded
                <div className="flex items-center justify-end md:justify-center flex-1 min-w-0" />
            )}

            {/* Right container - Combined oval with search + info buttons */}
            <div className={`flex items-center justify-center transition-all duration-300 ${showRightButtons ? 'w-auto opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
                {/* Combined oval container for mobile */}
                {isMobile && isOvalVisible && (
                    <div className="flex items-center bg-themewhite2 rounded-full px-2 py-2 gap-0 transition-all duration-300 overflow-hidden">
                        {/* Search button inside oval */}
                        <button
                            onClick={handleMobileSearchClick}
                            className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-themewhite transition-colors duration-200 mx-0.5"
                            aria-label="Search"
                        >
                            <SearchIcon className="h-5 w-5 stroke-themeblue1" />
                        </button>

                        {/* Info button inside oval */}
                        <button
                            onClick={() => { }} // Add info button handler if needed
                            className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-themewhite transition-colors duration-200 mx-0.5"
                            aria-label="Info"
                        >
                            <svg
                                className="h-5 w-5 stroke-themeblue1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Desktop layout - separate buttons with text on large screens */}
                {!isMobile && (
                    <div className="w-max h-full flex items-center justify-center gap-2">
                        {/* Import button - with text on large screens */}
                        <button
                            onClick={onImportClick}
                            className="flex items-center justify-center gap-2 px-3 py-3 rounded-full bg-themewhite2 hover:bg-themewhite transition-all duration-300 min-h-8"
                            aria-label="Import"
                        >
                            <svg
                                className="h-4 w-4 stroke-themeblue1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                            </svg>
                            <span className="hidden lg:inline text-[10pt] text-tertiary">
                                Import Note
                            </span>
                        </button>

                        {/* Theme toggle - with text on large screens */}
                        <button
                            onClick={toggleTheme}
                            className="flex items-center justify-center gap-2 px-3 py-3 rounded-full bg-themewhite2 hover:bg-themewhite transition-all duration-300 min-h-8"
                            aria-label="Toggle theme"
                        >
                            {theme === 'light' ? (
                                <svg className="h-4 w-4 stroke-themeblue1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                </svg>
                            ) : (
                                <svg className="h-4 w-4 stroke-themeblue1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            )}
                            <span className="hidden lg:inline text-[10pt] text-tertiary">
                                {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}