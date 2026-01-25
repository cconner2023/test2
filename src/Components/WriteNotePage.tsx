// components/WriteNotePage.tsx - UPDATED with proper copied state navigation
import { useState, useEffect, useRef } from 'react';
import type { dispositionType, AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import { useNoteCapture } from '../Hooks/useNoteCapture';
import { getColorClasses } from '../Utilities/ColorUtilities';
import { TextButton } from './TextButton';
import { NoteBarcodeGenerator } from './Barcode';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { DecisionMaking } from './DecisionMaking';
import type { medListTypes } from '../Data/MedData';

export type DispositionType = dispositionType['type'];
export type NoteViewState = 'input' | 'preview' | 'copied' | 'share';

type TabType = 'decision-making' | 'write-note';
interface WriteNoteProps {
    disposition: {
        type: DispositionType;
        text: string;
        addendum?: string;
    };
    algorithmOptions?: AlgorithmOptions[];
    cardStates?: CardState[];
    isExpanded: boolean;
    onExpansionChange: (expanded: boolean) => void;
    onNoteSave?: (note: string) => void;
    onMedicationClick?: (medication: medListTypes) => void
    onSwipeDown?: () => void;
}

export const WriteNotePage = ({
    disposition,
    algorithmOptions = [],
    cardStates = [],
    onExpansionChange,
    onNoteSave,
}: WriteNoteProps) => {
    const [viewState, setViewState] = useState<NoteViewState>('input');
    const [activeTab, setActiveTab] = useState<TabType>('decision-making');
    const [note, setNote] = useState<string>('');
    const [previewNote, setPreviewNote] = useState<string>('');
    const [includeAlgorithm, setIncludeAlgorithm] = useState<boolean>(true);
    const [includeHPI, setIncludeHPI] = useState<boolean>(false);
    const [previousViewState, setPreviousViewState] = useState<Exclude<NoteViewState, 'copied'>>('input');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const { generateNote } = useNoteCapture(algorithmOptions, cardStates);
    const colors = getColorClasses(disposition.type);
    const [parentRef] = useAutoAnimate<HTMLDivElement>({
        duration: 200,
        easing: 'ease-in-out',
    });

    // Handle copied timeout - return to previous view state
    useEffect(() => {
        let timeoutId: number;

        if (viewState === 'copied') {
            timeoutId = window.setTimeout(() => {
                setViewState(previousViewState);
            }, 2000);
        }
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [viewState, previousViewState]);


    // Generate preview
    useEffect(() => {
        if (viewState === 'preview') {
            const result = generateNote({
                includeAlgorithm: includeAlgorithm,
                customNote: note
            });
            setPreviewNote(result.fullNote);
        }
    }, [viewState, note, includeAlgorithm, generateNote]);

    const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNote(e.target.value);
    };

    const handleCopyToClipboard = (text: string, fromView: Exclude<NoteViewState, 'copied'>) => {
        navigator.clipboard.writeText(text);
        setPreviousViewState(fromView);
        setViewState('copied');

        if (onNoteSave) {
            onNoteSave(text);
        }
    };

    const handleClearNote = () => {
        setNote('');
        if (inputRef.current) {
            inputRef.current.focus();
        }
    };

    // Get encoded value from NoteBarcodeGenerator (you'll need to implement this)
    const getEncodedValue = () => {
        // This is a placeholder - you'll need to extract the actual encoded value
        // from your NoteBarcodeGenerator component
        return `[Encoded Note Data - Algorithm: ${algorithmOptions.length}, Cards: ${cardStates.length}]`;
    };

    return (
        <div className="flex flex-col bg-themewhite2 h-full w-full">
            {/* Header with disposition info */}
            <div className="p-4 rounded-t-md border-b border-themegray1/20">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <div className={`px-3 py-2 rounded-md flex items-center justify-center ${colors.badgeBg} font-bold text-sm ${colors.badgeText}`}>
                            {disposition.type}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-primary wrap-break-word">
                                {disposition.text}
                            </p>
                            {disposition.addendum && (
                                <p className="text-xs text-secondary mt-1 wrap-break-word">
                                    {disposition.addendum}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => onExpansionChange(false)}
                        className="p-2 text-tertiary hover:text-primary transition-colors md:p-1"
                        title="Close"
                        aria-label="Close note editor"
                    >
                        <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-themegray1/20">
                    <button
                        onClick={() => setActiveTab('decision-making')}
                        className={`flex-1 py-3 text-sm font-normal transition-all duration-100 ${activeTab === 'decision-making'
                            ? `text-primary border-b-2 ${colors.badgeBorder || colors.badgeBg}`
                            : 'text-tertiary hover:text-primary'
                            }`}
                    >
                        Decision Making
                    </button>
                    <button
                        onClick={() => setActiveTab('write-note')}
                        className={`flex-1 py-3 text-sm font-normal transition-all duration-100 ${activeTab === 'write-note'
                            ? `text-primary border-b-2 ${colors.badgeBorder || colors.badgeBg}`
                            : 'text-tertiary hover:text-primary'
                            }`}
                    >
                        Write Note
                    </button>
                </div>
            </div>

            {/* Main Content Area - Scrollable */}
            <div
                ref={parentRef}
                className="flex-1 overflow-y-auto p-2 bg-themewhite2"
            >
                {/* DECISION MAKING TAB CONTENT */}
                {activeTab === 'decision-making' && (
                    <DecisionMaking
                        algorithmOptions={algorithmOptions}
                        cardStates={cardStates}
                        disposition={disposition}
                        dispositionType={disposition.type}
                    />
                )}
                {/* WRITE NOTE TAB CONTENT */}
                {activeTab === 'write-note' && (
                    <>
                        {/* INPUT VIEW */}
                        {viewState === 'input' && (
                            <div
                                key={'input'}
                                className="space-y-6"
                            >
                                {/* Toggle Section - Grouped visually */}
                                <div className="p-4">
                                    <div className="text-xs font-normal text-primary mb-3">Additional Note Content:</div>
                                    <div className="space-y-3">
                                        {/* Decision Making Toggle */}
                                        <div
                                            onClick={() => setIncludeAlgorithm(!includeAlgorithm)}
                                            className={`text-xs p-3 rounded border transition-all duration-300 cursor-pointer
                                                ${includeAlgorithm
                                                    ? colors.symptomClass
                                                    : 'border border-themewhite2/10 text-secondary bg-themewhite hover:themewhite2/80 hover:shadow-sm'
                                                }`}
                                            role="checkbox"
                                            aria-checked={includeAlgorithm}
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setIncludeAlgorithm(!includeAlgorithm);
                                                }
                                            }}
                                        >
                                            <div className="font-normal flex items-center">
                                                <span className={`mr-2 ${includeAlgorithm ? 'opacity-100' : 'opacity-40'}`}>
                                                    {includeAlgorithm ? '✓' : ''}
                                                </span>
                                                Decision Making Algorithm
                                            </div>
                                        </div>

                                        {/* HPI Toggle - Manual control only */}
                                        <div
                                            onClick={() => setIncludeHPI(!includeHPI)}
                                            className={`text-xs p-3 rounded border transition-all duration-300 cursor-pointer
                                                ${includeHPI
                                                    ? colors.symptomClass
                                                    : 'border border-themewhite2/10 text-secondary bg-themewhite hover:themewhite2/80 hover:shadow-sm'
                                                }`}
                                            role="checkbox"
                                            aria-checked={includeHPI}
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setIncludeHPI(!includeHPI);
                                                }
                                            }}
                                        >
                                            <div className="font-normal flex items-center">
                                                <span className={`mr-2 ${includeHPI ? 'opacity-100' : 'opacity-40'}`}>
                                                    {includeHPI ? '✓' : ''}
                                                </span>
                                                HPI or other note
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Note Input Area */}
                                <div className="mt-2">
                                    <div className="relative">
                                        <textarea
                                            ref={inputRef}
                                            value={note}
                                            onChange={handleNoteChange}
                                            className="w-full h-40 p-3 rounded border border-themegray1 focus:border-themeblue2/30 text-[16px] focus:outline-none bg-white text-tertiary pr-10 resize-none transition-all duration-100"
                                            placeholder="Enter your clinical notes here..."
                                        />
                                        {note && (
                                            <button
                                                type="button"
                                                onClick={handleClearNote}
                                                className="absolute right-3 top-3 p-2 text-tertiary hover:text-primary transition-colors md:p-1"
                                                title="Clear notes"
                                                aria-label="Clear notes"
                                            >
                                                <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SHARE VIEW */}
                        {viewState === 'share' && (
                            <div
                                key={'share'}
                                className="space-y-6"
                            >
                                <div className="p-2 text-[10pt] font-normal text-primary">Share Encoded Note</div>
                                <div className="relative">
                                    <NoteBarcodeGenerator
                                        algorithmOptions={algorithmOptions}
                                        cardStates={cardStates}
                                        noteOptions={{ includeAlgorithm: includeAlgorithm, customNote: note }}
                                        symptomCode="A1"
                                    />
                                    {/* Copy icon for the entire barcode/encoded value */}
                                    <button
                                        onClick={() => handleCopyToClipboard(getEncodedValue(), 'share')}
                                        className="absolute top-3 right-3 p-2 text-tertiary hover:text-themeblue3 transition-colors md:top-2 md:right-2 md:p-1"
                                        title="Copy encoded value"
                                        aria-label="Copy encoded value"
                                    >
                                        <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* PREVIEW VIEW */}
                        {viewState === 'preview' && (
                            <div
                                key={'preview'}
                                className="space-y-6"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-normal text-primary">Note Preview</div>
                                    <div className="flex items-center gap-1 text-[9px]">
                                        {includeAlgorithm && (
                                            <span className={`px-2 py-2 rounded-md ${colors.symptomClass}`}>
                                                Algorithm
                                            </span>
                                        )}
                                        {includeAlgorithm && includeHPI && "•"}
                                        {includeHPI && (
                                            <span className={`px-2 py-2 rounded-md ${colors.symptomClass}`}>
                                                HPI
                                            </span>
                                        )}
                                        {(!includeAlgorithm && !includeHPI) && (
                                            <span className="text-tertiary">No content selected</span>
                                        )}
                                    </div>
                                </div>
                                {/* Scrollable note preview area with copy icon */}
                                <div className="relative">
                                    <div className="w-full max-h-96 p-3 rounded-md bg-themewhite3 text-tertiary text-[8pt] whitespace-pre-wrap overflow-y-auto">
                                        {previewNote || "No content selected"}
                                    </div>
                                    {/* Copy icon in top-right corner - larger on mobile */}
                                    <button
                                        onClick={() => handleCopyToClipboard(previewNote, 'preview')}
                                        className="absolute top-2 right-2 p-2 text-tertiary hover:text-primary transition-colors md:top-1 md:right-1 md:p-1"
                                        title="Copy note to clipboard"
                                        aria-label="Copy note to clipboard"
                                    >
                                        <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* COPIED VIEW */}
                        {viewState === 'copied' && (
                            <div
                                key={'copied'}
                                className="flex flex-col items-center justify-center h-full"
                            >
                                <div className="mb-4">
                                    <div className={`w-16 h-16 rounded-full ${colors.symptomClass.replace('border-', 'border ').replace('bg-', 'bg-')} flex items-center justify-center md:w-12 md:h-12`}>
                                        <svg
                                            className="w-8 h-8 md:w-6 md:h-6 text-primary"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <h3 className="text-base font-semibold text-primary md:text-sm">
                                        Copied to Clipboard
                                    </h3>
                                    <p className="text-sm text-tertiary mt-1 md:text-xs">
                                        Returning to {previousViewState === 'preview' ? 'preview' : 'share'}...
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Action Buttons - Fixed at bottom (only for write-note tab) */}
            {activeTab === 'write-note' && (
                <div className="flex items-center justify-end gap-3 p-4 border-t border-themegray1/30 flex-none bg-themewhite2">
                    {/* Back/Edit button - only shown when applicable */}
                    {(viewState === 'preview' || viewState === 'share') && (
                        <TextButton
                            text="← Back"
                            onClick={() => {
                                if (viewState === 'share') {
                                    setViewState('preview');
                                } else {
                                    setViewState('input');
                                }
                            }}
                            variant="special"
                        />
                    )}

                    {/* Primary action button - use dispo-specific variant with buttonClass */}
                    {viewState === 'input' && (
                        <TextButton
                            text="View Note"
                            onClick={() => setViewState('preview')}
                            variant="dispo-specific"
                            className={`${colors.buttonClass} rounded-md`}
                        />
                    )}

                    {viewState === 'preview' && (
                        <TextButton
                            text="Share"
                            onClick={() => setViewState('share')}
                            variant="dispo-specific"
                            className={`${colors.buttonClass} rounded-md`}
                        />
                    )}

                    {viewState === 'share' && (
                        <TextButton
                            text="Done"
                            onClick={() => onExpansionChange(false)}
                            variant="dispo-specific"
                            className={`${colors.buttonClass} rounded-md`}
                        />
                    )}
                </div>
            )}
        </div>
    );
};