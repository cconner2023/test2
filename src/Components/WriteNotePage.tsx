// Updated WriteNotePage.tsx with clean underlined tabs at close button level
import { useState, useEffect, useRef, useCallback } from 'react';
import type { dispositionType, AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import { useNoteCapture } from '../Hooks/useNoteCapture';
import { getColorClasses } from '../Utilities/ColorUtilities';
import { TextButton } from './TextButton';
import { NoteBarcodeGenerator } from './Barcode';
import { useAppAnimate } from '../Utilities/AnimationConfig';
import { DecisionMaking } from './DecisionMaking';

export type DispositionType = dispositionType['type'];
export type NoteViewState = 'input' | 'preview' | 'copied' | 'share';

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
    selectedSymptom?: {
        icon: string;
        text: string;
    };
    isMobile?: boolean;
}

export const WriteNotePage = ({
    disposition,
    algorithmOptions = [],
    cardStates = [],
    onExpansionChange,
    onNoteSave,
    selectedSymptom = { icon: '', text: '' },
    isMobile = false,
}: WriteNoteProps) => {
    // State
    const [viewState, setViewState] = useState<NoteViewState>('input');
    const [activeTab, setActiveTab] = useState<'decision-making' | 'write-note'>('decision-making');
    const [note, setNote] = useState<string>('');
    const [previewNote, setPreviewNote] = useState<string>('');
    const [includeAlgorithm, setIncludeAlgorithm] = useState<boolean>(true);
    const [includeDecisionMaking, setIncludeDecisionMaking] = useState<boolean>(true);
    const [includeHPI, setIncludeHPI] = useState<boolean>(false);
    const [previousViewState, setPreviousViewState] = useState<Exclude<NoteViewState, 'copied'>>('input');
    const [encodedValue, setEncodedValue] = useState<string>('');

    // Refs & Hooks
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { generateNote } = useNoteCapture(algorithmOptions, cardStates);
    const colors = getColorClasses(disposition.type);
    const [parentRef] = useAppAnimate<HTMLDivElement>('fast');

    // Effects
    useEffect(() => {
        if (viewState === 'copied') {
            const timeoutId = window.setTimeout(() => {
                setViewState(previousViewState);
            }, 2000);
            return () => clearTimeout(timeoutId);
        }
    }, [viewState, previousViewState]);

    useEffect(() => {
        if (viewState === 'preview') {
            const result = generateNote(
                {
                    includeAlgorithm,
                    includeDecisionMaking,
                    customNote: includeHPI ? note : ''
                },
                disposition.type,
                disposition.text,
                selectedSymptom
            );
            setPreviewNote(result.fullNote);
        }
    }, [viewState, note, includeAlgorithm, includeDecisionMaking, includeHPI, generateNote, disposition, selectedSymptom]);

    // Event Handlers
    const handleCopyToClipboard = useCallback((text: string, fromView: Exclude<NoteViewState, 'copied'>) => {
        navigator.clipboard.writeText(text);
        setPreviousViewState(fromView);
        setViewState('copied');
        onNoteSave?.(text);
    }, [onNoteSave]);

    const handleClearNoteAndHide = () => {
        setNote('');
        setIncludeHPI(false)
        inputRef.current?.focus();
    };

    // Tab Content Renderers
    const renderInputView = () => (
        <div key="input" className="space-y-6">
            <div className="p-4">
                <div className="text-[10pt] font-normal text-primary mb-3">Note Content:</div>
                <div className="space-y-3">
                    {/* Algorithm Checkbox */}
                    <ToggleOption
                        checked={includeAlgorithm}
                        onChange={() => setIncludeAlgorithm(!includeAlgorithm)}
                        label="Algorithm"
                        colors={colors}
                    />

                    {/* Decision Making Checkbox */}
                    <ToggleOption
                        checked={includeDecisionMaking}
                        onChange={() => setIncludeDecisionMaking(!includeDecisionMaking)}
                        label="Decision Making"
                        colors={colors}
                    />

                    {/* HPI Checkbox (only shown when HPI is NOT selected) */}
                    {!includeHPI && (
                        <ToggleOption
                            checked={includeHPI}
                            onChange={() => {
                                setIncludeHPI(true);
                                setTimeout(() => inputRef.current?.focus(), 100);
                            }}
                            label="HPI or other clinical note"
                            colors={colors}
                        />
                    )}

                    {/* HPI Input (shown only when HPI is checked - replaces the checkbox) */}
                    {includeHPI && (
                        <div className="transition-all duration-200 ease-in-out">
                            <div className={`flex items-center justify-center transition-all duration-300 bg-themewhite text-tertiary rounded-md border border-themeblue3/10 shadow-xs focus-within:border-themeblue1/30 focus-within:bg-themewhite2`}>
                                <textarea
                                    ref={inputRef}
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="text-tertiary bg-transparent outline-none text-[16px] md:text-[8pt] w-full px-4 py-2 rounded-l-full min-w-0 resize-none h-10 leading-5"
                                />
                                {/* Clear Button - Clears note AND hides HPI */}
                                <div
                                    className="flex items-center justify-center px-2 py-2 bg-transparent stroke-themeblue3 cursor-pointer transition-all duration-300 shrink-0"
                                    onClick={handleClearNoteAndHide}
                                    title="Remove HPI and clear notes"
                                    aria-label="Remove HPI and clear notes"
                                >
                                    <svg className="h-5 w-5 stroke-themeblue1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <p className="text-xs text-secondary italic">
                                    Enter your HPI or other clinical notes above
                                </p>
                                {/* Removed the separate "Remove HPI" button */}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderShareView = () => (
        <div key="share" className="space-y-6">
            <div className="p-2 text-[10pt] font-normal text-primary">Share Encoded Note</div>
            <div className="relative">
                <NoteBarcodeGenerator
                    algorithmOptions={algorithmOptions}
                    cardStates={cardStates}
                    noteOptions={{
                        includeAlgorithm,
                        customNote: includeHPI ? note : ''
                    }}
                    symptomCode="A1"
                    onEncodedValueChange={setEncodedValue}
                />
                <CopyButton
                    onClick={() => handleCopyToClipboard(encodedValue, 'share')}
                    title="Copy encoded value"
                />
            </div>
        </div>
    );

    const renderPreviewView = () => (
        <div key="preview" className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="text-xs font-normal text-primary">Note Preview</div>
                <div className="flex items-center gap-1 text-[9px]">
                    {includeAlgorithm && (
                        <span className={`px-2 py-2 rounded-md ${colors.symptomClass}`}>
                            Algorithm
                        </span>
                    )}
                    {includeAlgorithm && includeDecisionMaking && (
                        <span className="text-tertiary mx-1">•</span>
                    )}
                    {includeDecisionMaking && (
                        <span className={`px-2 py-2 rounded-md ${colors.symptomClass}`}>
                            Decision Making
                        </span>
                    )}
                    {(includeAlgorithm || includeDecisionMaking) && includeHPI && (
                        <span className="text-tertiary mx-1">•</span>
                    )}
                    {includeHPI && (
                        <span className={`px-2 py-2 rounded-md ${colors.symptomClass}`}>
                            HPI
                        </span>
                    )}
                    {(!includeAlgorithm && !includeDecisionMaking && !includeHPI) && (
                        <span className="text-tertiary">No content selected</span>
                    )}
                </div>
            </div>
            <div className="relative">
                <div className="w-full max-h-96 p-3 rounded-md bg-themewhite3 text-tertiary text-[8pt] whitespace-pre-wrap overflow-y-auto">
                    {previewNote || "No content selected"}
                </div>
                <CopyButton
                    onClick={() => handleCopyToClipboard(previewNote, 'preview')}
                    title="Copy note to clipboard"
                />
            </div>
        </div>
    );

    const renderCopiedView = () => (
        <div key="copied" className="flex flex-col items-center justify-center h-full">
            <div className="mb-4">
                <div className={`w-16 h-16 rounded-full ${colors.symptomClass} flex items-center justify-center`}>
                    <CheckIcon />
                </div>
            </div>
            <div className="text-center">
                <h3 className="text-base font-semibold text-primary">Copied to Clipboard</h3>
                <p className="text-sm text-tertiary mt-1">
                    Returning to {previousViewState}...
                </p>
            </div>
        </div>
    );

    // Main render
    return (
        <div className={`flex flex-col bg-themewhite2 h-full w-full rounded-md ${isMobile && activeTab === 'write-note' ? 'pb-10' : ''}`}>
            {/* Clean Header with Underlined Tabs and Close Button */}
            <div className="sticky top-0 z-10 bg-themewhite2 rounded-t-md border-b border-themegray1/20">
                <div className="flex items-center justify-between px-4 pt-4">
                    {/* Underlined Tab Navigation */}
                    <div className="flex-1 flex">
                        {(['decision-making', 'write-note'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`relative flex-1 py-2 text-sm font-medium transition-all duration-200
                                    ${activeTab === tab
                                        ? 'text-primary'
                                        : 'text-tertiary hover:text-primary'
                                    }`}
                            >
                                {tab === 'decision-making' ? 'Decision Making' : 'Write Note'}

                                {/* Active indicator line */}
                                {activeTab === tab && (
                                    <div
                                        className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-all duration-200 ${colors.symptomClass}`}
                                    />
                                )}

                                {/* Hover indicator line */}
                                {activeTab !== tab && (
                                    <div
                                        className="absolute bottom-0 left-1/2 right-1/2 h-0.5 bg-themegray1/30 rounded-full opacity-0 hover:opacity-100 hover:left-1/4 hover:right-1/4 transition-all duration-200"
                                    />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={() => onExpansionChange(false)}
                        className="shrink-0 ml-4 p-2 text-tertiary hover:text-primary transition-colors rounded-full hover:bg-themewhite3"
                        title="Close"
                        aria-label="Close"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Subtle spacing below tabs */}
                <div className="pb-2"></div>
            </div>

            {/* Main Content */}
            <div ref={parentRef} className="flex-1 overflow-y-auto p-2 bg-themewhite2">
                {activeTab === 'decision-making' ? (
                    <DecisionMaking
                        algorithmOptions={algorithmOptions}
                        cardStates={cardStates}
                        disposition={disposition}
                        dispositionType={disposition.type}
                    />
                ) : (
                    <>
                        {viewState === 'input' && renderInputView()}
                        {viewState === 'share' && renderShareView()}
                        {viewState === 'preview' && renderPreviewView()}
                        {viewState === 'copied' && renderCopiedView()}
                    </>
                )}
            </div>

            {/* Action Buttons */}
            {activeTab === 'write-note' && (
                <ActionButtons
                    viewState={viewState}
                    colors={colors}
                    onBack={() => {
                        if (viewState === 'share') setViewState('preview');
                        else setViewState('input');
                    }}
                    onViewNote={() => setViewState('preview')}
                    onShare={() => setViewState('share')}
                    onDone={() => onExpansionChange(false)}
                />
            )}
        </div>
    );
};

// Helper Components (remain the same)
const ToggleOption: React.FC<{
    checked: boolean;
    onChange: () => void;
    label: string;
    colors: any;
}> = ({ checked, onChange, label, colors }) => (
    <div
        onClick={onChange}
        className={`text-xs p-3 rounded border transition-all duration-300 cursor-pointer
            ${checked ? colors.symptomClass : 'border border-themewhite2/10 text-secondary bg-themewhite hover:themewhite2/80 hover:shadow-sm'}`}
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange();
            }
        }}
    >
        <div className="font-normal flex items-center">
            <span className={`mr-2 ${checked ? 'opacity-100' : 'opacity-40'}`}>
                {checked ? '✓' : ''}
            </span>
            {label}
        </div>
    </div>
);

const CopyButton: React.FC<{ onClick: () => void; title: string }> = ({ onClick, title }) => (
    <button
        onClick={onClick}
        className="absolute top-3 right-3 p-2 text-tertiary hover:text-primary transition-colors"
        title={title}
    >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
    </button>
);

const CheckIcon: React.FC = () => (
    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
    </svg>
);

const ActionButtons: React.FC<{
    viewState: NoteViewState;
    colors: any;
    onBack: () => void;
    onViewNote: () => void;
    onShare: () => void;
    onDone: () => void;
}> = ({ viewState, colors, onBack, onViewNote, onShare, onDone }) => (
    <div className={`flex items-start gap-2 justify-end p-4 shrink-0`}>
        {/* Back/Edit button - only shown when applicable */}
        {(viewState === 'preview' || viewState === 'share') && (
            <TextButton
                text="← Back"
                onClick={onBack}
                variant="dispo-specific"
                className='bg-themewhite3 text-tertiary rounded-full'
            />
        )}

        {/* Primary action button - use dispo-specific variant with buttonClass */}
        {viewState === 'input' && (
            <TextButton
                text="View Note"
                onClick={onViewNote}
                variant="dispo-specific"
                className={`${colors.buttonClass} rounded-full`}
            />
        )}

        {viewState === 'preview' && (
            <TextButton
                text="Share"
                onClick={onShare}
                variant="dispo-specific"
                className={`${colors.buttonClass} rounded-full`}
            />
        )}

        {viewState === 'share' && (
            <TextButton
                text="Done"
                onClick={onDone}
                variant="dispo-specific"
                className={`${colors.buttonClass} rounded-full`}
            />
        )}
    </div>
);