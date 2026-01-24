// NavTop.tsx - With Mobile Search Expansion
import { SearchIcon, X } from "lucide-react";
import { useRef, useEffect } from "react";
import { ThemeButton } from "./ThemeButton";
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
    const { toggleTheme } = useTheme();

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

    return (
        <div className="flex items-center h-full w-full px-4 gap-4 bg-themewhite transition-all duration-300">
            {/* Left section: buttons and title */}
            <div className="flex items-center gap-3 shrink-0">
                {/* Menu/Back button */}
                <div className="flex justify-center space-x-3">
                    {/* Back Button */}
                    {showBack && (
                        <ThemeButton
                            iconId="arrowLeft"
                            text="Back"
                            iconWidth={16}
                            iconHeight={18}
                            onClick={onBackClick}
                            className="stroke-themeblue1 text-primary/60"
                            iconColor="themeblue1"
                        />
                    )}
                    {/* Menu Button (mobile only) */}
                    {showMenu && (
                        <ThemeButton
                            iconId="menu"
                            text="Home"
                            iconWidth={17}
                            iconHeight={29}
                            onClick={onMenuClick}
                            className="stroke-themeblue1 md:hidden flex text-tertiary"
                            iconColor="themeblue1"
                        />
                    )}
                    {/* Desktop only medications/ADTMC button */}
                    {!isMobile && (
                        <ThemeButton
                            iconId="pill"
                            text={medicationButtonText}
                            className="stroke-themeblue1 text-tertiary"
                            iconColor="themeblue1"
                            onClick={onMedicationClick}
                        />
                    )}
                </div>
                {/* Title - Hide when mobile search is expanded */}
                {(!isMobile || !isSearchExpanded) && (
                    <div className={`truncate whitespace-nowrap transition-opacity duration-300 ${isSearchExpanded ? 'opacity-0' : 'opacity-100'}`}>
                        <span className={isMobile ? "md:hidden" : ""}>
                            {showDynamicTitle && dynamicTitle ? (
                                <span className="text-[12pt] md:hidden block text-primary font-semibold">{dynamicTitle}</span>
                            ) : (
                                <span className="text-[12pt] md:hidden block text-primary font-semibold">ADTMC 3.5</span>
                            )}
                        </span>
                    </div>
                )}
            </div>

            {/* Search Container */}
            <div className="flex items-center justify-end md:justify-center flex-1">
                {/* Mobile: Collapsed state (just icon) */}
                {isMobile && !isSearchExpanded ? (
                    <button
                        onClick={handleMobileSearchClick}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-themewhite2 hover:bg-themewhite transition-colors duration-100"
                        aria-label="Search"
                    >
                        <SearchIcon className="h-5 w-5 stroke-themeblue1" />
                    </button>
                ) : (
                    /* Desktop always visible OR Mobile expanded */
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
                            className="text-tertiary bg-transparent outline-none text-xs w-full px-4 py-2 rounded-l-full"
                        />

                        <div
                            className="flex items-center justify-center px-2 py-2 bg-themewhite2 stroke-themeblue3 rounded-r-full cursor-pointer transition-all duration-300 hover:bg-themewhite"
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
                )}
            </div>

            {/* Right container */}
            <div className="w-max h-full flex items-center justify-center gap-3">
                {/* Import button (desktop only) */}
                {!isMobile && (
                    <ThemeButton
                        iconId="import"
                        className="stroke-themeblue1 text-tertiary"
                        iconColor="themeblue1"
                        onClick={onImportClick}
                    />
                )}

                {/* Theme toggle (desktop only) */}
                {!isMobile && (
                    <ThemeButton
                        iconId={useTheme().theme === 'light' ? 'dark' : 'light'}
                        className="stroke-themeblue1 text-tertiary"
                        iconColor="themeblue1"
                        onClick={toggleTheme}
                    />
                )}

                {/* Info button (mobile only with back and title) */}
                {isMobile && showBack && showDynamicTitle && (
                    <ThemeButton
                        iconId="info"
                        className="stroke-themeblue1 text-tertiary"
                        iconColor="themeblue1"
                    />
                )}
            </div>
        </div>
    );
}