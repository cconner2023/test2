import type { RefObject } from 'react';
import { Check, Copy, Share2, FileDown, ChevronRight, CalendarCheck } from 'lucide-react';
import type { getColorClasses } from '../Utilities/ColorUtilities';
import type { TextExpander } from '../Data/User';
import type { useTemplateSession } from '../Hooks/useTemplateSession';
import type { useTextExpander } from '../Hooks/useTextExpander';
import { TextExpanderSuggestion } from './TextExpanderSuggestion';
import { TemplateOverlay } from './TemplateOverlay';
import { PIIWarningBanner } from './PIIWarningBanner';

// ---------------------------------------------------------------------------
// Utility: apply text + cursor to a textarea, batching with rAF cursor sync.
// ---------------------------------------------------------------------------

export function applyToTextarea(
    ref: RefObject<HTMLTextAreaElement | null>,
    setNote: (v: string) => void,
    setCursorPosition: (v: number) => void,
    text: string,
    cursor: number,
    focus = false,
) {
    setNote(text);
    setCursorPosition(cursor);
    requestAnimationFrame(() => {
        const ta = ref.current;
        if (ta) {
            ta.selectionStart = cursor;
            ta.selectionEnd = cursor;
            if (focus) ta.focus();
        }
    });
}

// ---------------------------------------------------------------------------
// Factory: create the HPI textarea onKeyDown handler.
// Handles template session navigation and text expander acceptance.
// ---------------------------------------------------------------------------

interface HPIKeyDownDeps {
    inputRef: RefObject<HTMLTextAreaElement | null>;
    note: string;
    cursorPosition: number;
    setNote: (v: string) => void;
    setCursorPosition: (v: number) => void;
    templateSession: ReturnType<typeof useTemplateSession>['session'];
    stepStartRef: ReturnType<typeof useTemplateSession>['stepStartRef'];
    fillCurrentAndAdvance: ReturnType<typeof useTemplateSession>['fillCurrentAndAdvance'];
    dismissDropdown: ReturnType<typeof useTemplateSession>['dismissDropdown'];
    selectNextChoice: ReturnType<typeof useTemplateSession>['selectNextChoice'];
    selectPrevChoice: ReturnType<typeof useTemplateSession>['selectPrevChoice'];
    endSession: ReturnType<typeof useTemplateSession>['endSession'];
    startSession: ReturnType<typeof useTemplateSession>['startSession'];
    expanderSuggestions: TextExpander[];
    expanderIndex: number;
    acceptExpander: ReturnType<typeof useTextExpander>['accept'];
    dismissExpander: ReturnType<typeof useTextExpander>['dismiss'];
    expanderNext: ReturnType<typeof useTextExpander>['selectNext'];
    expanderPrev: ReturnType<typeof useTextExpander>['selectPrev'];
    hasExpanderSuggestion: boolean;
}

export function createHPIKeyDownHandler(deps: HPIKeyDownDeps) {
    return (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const apply = (text: string, cursor: number, focus = false) =>
            applyToTextarea(deps.inputRef, deps.setNote, deps.setCursorPosition, text, cursor, focus);

        // --- Template session keyboard handlers ---
        if (deps.templateSession.isActive && deps.templateSession.activeNode) {
            const { activeNode } = deps.templateSession;

            if (e.key === 'Escape') {
                e.preventDefault();
                if (activeNode.type === 'choice' && deps.templateSession.showDropdown) {
                    deps.dismissDropdown();
                } else {
                    deps.endSession();
                }
                return;
            }
            if (deps.templateSession.showDropdown && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
                e.preventDefault();
                if (e.key === 'ArrowRight') deps.selectNextChoice();
                else deps.selectPrevChoice();
                return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (deps.templateSession.showDropdown && deps.templateSession.selectedChoiceIndex >= 0 && activeNode.options) {
                    const opts = activeNode.options.filter((o) => o.trim() !== '');
                    if (deps.templateSession.selectedChoiceIndex < opts.length) {
                        const result = deps.fillCurrentAndAdvance(deps.note, opts[deps.templateSession.selectedChoiceIndex]);
                        if (result) apply(result.newText, result.cursorPosition);
                    } else if (activeNode.type === 'choice') {
                        deps.dismissDropdown();
                    }
                    return;
                }
                if (activeNode.type === 'branch') return;
                const typedValue = deps.note.slice(deps.stepStartRef.current, deps.cursorPosition);
                const result = deps.fillCurrentAndAdvance(deps.note, typedValue);
                if (result) apply(result.newText, result.cursorPosition);
                return;
            }
            if (activeNode.type === 'branch') {
                if (!e.shiftKey) e.preventDefault();
                return;
            }
            return;
        }

        // --- Text expander keyboard handlers ---
        if (e.key === 'Escape' && deps.hasExpanderSuggestion) {
            e.preventDefault();
            deps.dismissExpander();
            return;
        }
        if (deps.hasExpanderSuggestion && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            if (e.key === 'ArrowDown') deps.expanderNext();
            else deps.expanderPrev();
            return;
        }
        if (e.key === 'Enter' && deps.hasExpanderSuggestion && !e.shiftKey) {
            e.preventDefault();
            const result = deps.acceptExpander();
            if (result) {
                const accepted = deps.expanderSuggestions[deps.expanderIndex];
                if (accepted?.template && accepted.template.length > 0) {
                    const abbrStart = result.newCursorPosition - accepted.expansion.length;
                    const cleaned = result.newText.slice(0, abbrStart) + result.newText.slice(result.newCursorPosition);
                    const tmpl = deps.startSession(cleaned, abbrStart, accepted.template);
                    apply(tmpl.newText, tmpl.cursorPosition);
                } else {
                    apply(result.newText, result.newCursorPosition);
                }
            }
            return;
        }
    };
}

export const ActionIconButton = ({
    onClick,
    status,
    variant,
    title,
}: {
    onClick: () => void;
    status: 'idle' | 'busy' | 'done';
    variant: 'copy' | 'share' | 'pdf' | 'calendar';
    title: string;
}) => {
    const colorClass = status === 'done' ? 'text-themegreen'
        : status === 'busy' ? 'text-purple-600'
            : 'text-tertiary hover:text-primary hover:bg-themewhite3';

    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`p-1.5 transition-colors rounded-full ${colorClass}`}
            title={title}
        >
            {status === 'busy' ? (
                <svg className="w-4 h-4 animate-spin" style={{ animationDuration: '2s' }} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g transform="translate(20,20)">
                        <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill="currentColor" />
                        <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill="currentColor" transform="rotate(60)" />
                        <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill="currentColor" transform="rotate(120)" />
                    </g>
                </svg>
            ) : status === 'done' ? (
                <Check className="w-4 h-4" />
            ) : variant === 'copy' ? (
                <Copy className="w-4 h-4" />
            ) : variant === 'share' ? (
                <Share2 className="w-4 h-4" />
            ) : variant === 'calendar' ? (
                <CalendarCheck className="w-4 h-4" />
            ) : (
                <FileDown className="w-4 h-4" />
            )}
        </button>
    );
};

export const ToggleOption: React.FC<{
    checked: boolean;
    onChange: () => void;
    label: string;
    onDescription: string;
    offDescription: string;
    icon: React.ReactNode;
    colors: ReturnType<typeof getColorClasses>;
}> = ({ checked, onChange, label, onDescription, offDescription, icon, colors }) => (
    <div
        onClick={onChange}
        className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer
            ${checked
                ? colors.symptomClass
                : 'border-tertiary/15 bg-themewhite2'
            }`}
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(); }
        }}
    >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${checked ? `${colors.sliderClass}/15` : 'bg-tertiary/10'}`}>
            <span className={checked ? colors.symptomCheck : 'text-tertiary'}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${checked ? 'text-primary' : 'text-tertiary'}`}>{label}</p>
            <p className="text-[9pt] text-tertiary mt-0.5">{checked ? onDescription : offDescription}</p>
        </div>
        <div className={`w-10 h-6 rounded-full relative transition-colors ${checked ? colors.sliderClass : 'bg-tertiary/25'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </div>
    </div>
);

// Status helpers — map share/export status strings to icon states.
export function shareStatusToIconStatus(status: string): 'idle' | 'busy' | 'done' {
    if (status === 'shared' || status === 'copied') return 'done';
    if (status === 'generating' || status === 'sharing') return 'busy';
    return 'idle';
}

export function exportStatusToIconStatus(status: string): 'idle' | 'busy' | 'done' {
    if (status === 'done') return 'done';
    if (status === 'generating') return 'busy';
    return 'idle';
}

// ProgressDots — Step indicator dots for multi-page wizards.
// Used by WriteNotePage (via BaseDrawer's progressDots slot) and TC3MobileWizard.

export const ProgressDots = ({
    pages,
    currentPage,
    colorClass,
}: {
    pages: { id: string; label: string }[];
    currentPage: number;
    colorClass: string;
}) => (
    <div className="flex gap-1.5 mt-2">
        {pages.map((page, idx) => (
            <div
                key={page.id}
                className={`h-1 rounded-full transition-all duration-300 ${idx === currentPage
                    ? `w-4 ${colorClass}`
                    : idx < currentPage
                        ? `w-1.5 ${colorClass} opacity-40`
                        : 'w-1.5 bg-themegray1/30'
                    }`}
            />
        ))}
    </div>
);

// NoteHPIEditor — HPI textarea with text expander, template overlay, PII banner.
// Shared note-wizard UI component.

export const NoteHPIEditor = ({
    inputRef, note, setNote, setCursorPosition,
    hpiKeyDownHandler, templateSession, fillCurrentAndAdvance,
    endSession, dismissDropdown,
    hasExpanderSuggestion, expanderSuggestions, expanderIndex, dismissExpander,
    acceptExpander, startSession,
    piiWarnings,
}: {
    inputRef: RefObject<HTMLTextAreaElement | null>;
    note: string;
    setNote: (v: string) => void;
    setCursorPosition: (v: number) => void;
    hpiKeyDownHandler: React.KeyboardEventHandler<HTMLTextAreaElement>;
    templateSession: ReturnType<typeof useTemplateSession>['session'];
    fillCurrentAndAdvance: ReturnType<typeof useTemplateSession>['fillCurrentAndAdvance'];
    endSession: () => void;
    dismissDropdown: () => void;
    hasExpanderSuggestion: boolean;
    expanderSuggestions: TextExpander[];
    expanderIndex: number;
    dismissExpander: () => void;
    acceptExpander: ReturnType<typeof useTextExpander>['accept'];
    startSession: ReturnType<typeof useTemplateSession>['startSession'];
    piiWarnings: string[];
}) => (
    <div className="mx-2 relative">
        <textarea
            ref={inputRef}
            value={note}
            onChange={(e) => { setNote(e.target.value); setCursorPosition(e.target.selectionStart); }}
            onSelect={(e) => setCursorPosition((e.target as HTMLTextAreaElement).selectionStart)}
            onBlur={() => { if (templateSession.isActive) endSession(); }}
            onKeyDown={hpiKeyDownHandler}
            placeholder="History of present illness, clinical observations, assessment..."
            className="w-full text-tertiary bg-themewhite outline-none text-[12pt] md:text-[10pt] px-4 py-3 rounded-md border border-themegray1/20 min-w-0 resize-none min-h-[12rem] leading-6 focus:border-themeblue1/30 transition-colors"
        />
        {hasExpanderSuggestion && !templateSession.isActive && (
            <TextExpanderSuggestion
                suggestions={expanderSuggestions}
                selectedIndex={expanderIndex}
                onDismiss={dismissExpander}
                onAccept={(expander) => {
                    const result = acceptExpander(expander);
                    if (result) {
                        if (expander.template && expander.template.length > 0) {
                            const abbrStart = result.newCursorPosition - expander.expansion.length;
                            const cleaned = result.newText.slice(0, abbrStart) + result.newText.slice(result.newCursorPosition);
                            const tmpl = startSession(cleaned, abbrStart, expander.template);
                            applyToTextarea(inputRef, setNote, setCursorPosition, tmpl.newText, tmpl.cursorPosition, true);
                        } else {
                            applyToTextarea(inputRef, setNote, setCursorPosition, result.newText, result.newCursorPosition, true);
                        }
                    }
                }}
            />
        )}
        {templateSession.isActive && templateSession.activeNode && (
            <TemplateOverlay
                activeNode={templateSession.activeNode}
                showDropdown={templateSession.showDropdown}
                selectedChoiceIndex={templateSession.selectedChoiceIndex}
                onSelectOption={(value) => {
                    const result = fillCurrentAndAdvance(note, value);
                    if (result) applyToTextarea(inputRef, setNote, setCursorPosition, result.newText, result.cursorPosition, true);
                }}
                onDismissDropdown={dismissDropdown}
                onEndSession={endSession}
            />
        )}
        <PIIWarningBanner warnings={piiWarnings} />
    </div>
);
// NoteWizardFooter — Next button footer.
// Shared note-wizard UI component.

export const NoteWizardFooter = ({
    currentPage, visiblePages, slideDirection,
    handleNext, hasPII, colors, isMobile,
}: {
    currentPage: number;
    visiblePages: { id: string; label: string }[];
    slideDirection: 'left' | 'right' | '';
    handleNext: () => void;
    hasPII: boolean;
    colors: ReturnType<typeof getColorClasses>;
    isMobile: boolean;
}) => (
    <div
        className={`flex items-center gap-2 justify-between shrink-0 ${isMobile ? 'px-6 pt-4 pb-6' : 'p-4'}`}
        style={isMobile ? { paddingBottom: 'max(2rem, calc(var(--sab, 0px) + 2rem))' } : {}}
    >
        <div />
        <div key={currentPage} className={`flex items-center gap-2 ${slideDirection === 'left' ? 'animate-footer-btn-left' : slideDirection === 'right' ? 'animate-footer-btn-right' : ''}`}>
            {currentPage < visiblePages.length - 1 && (
                <button
                    data-tour="writenote-next"
                    onClick={handleNext}
                    disabled={hasPII}
                    className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all md:w-auto md:h-auto md:px-5 md:py-2.5 md:rounded-xl md:gap-2 disabled:opacity-40 ${colors.buttonClass}`}
                    aria-label="Next"
                    title={hasPII ? 'Remove PII/PHI before continuing' : undefined}
                >
                    <span className="hidden md:inline text-sm font-medium">Next</span>
                    <ChevronRight className="w-6 h-6" />
                </button>
            )}
        </div>
    </div>
);
