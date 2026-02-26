import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from './useAlgorithm';
import { useNoteCapture } from './useNoteCapture';
import { useNoteShare } from './useNoteShare';
import { useDD689Export } from './useDD689Export';
import { useUserProfile } from './useUserProfile';
import { useAuthStore } from '../stores/useAuthStore';
import { usePageSwipe } from './usePageSwipe';
import { useTextExpander } from './useTextExpander';
import { useTemplateSession } from './useTemplateSession';
import { detectPII } from '../lib/piiDetector';
import { formatSignature } from '../Utilities/NoteFormatter';
import { getColorClasses } from '../Utilities/ColorUtilities';
import { UI_TIMING } from '../Utilities/constants';
import { copyWithHtml } from '../Utilities/clipboardUtils';
import { createHPIKeyDownHandler } from '../Components/WriteNoteHelpers';

type PageId = string;

export interface NoteEditorConfig {
    algorithmOptions: AlgorithmOptions[];
    cardStates: CardState[];
    includeAlgorithm: boolean;
    dispositionType: string;
    dispositionText: string;
    selectedSymptom?: { icon: string; text: string };
    visiblePages: { id: string; label: string }[];
    isMobile: boolean;
    initialPage?: number;
    colors: ReturnType<typeof getColorClasses>;
    // Optional — WriteNotePage manages these externally
    includeDecisionMaking?: boolean;
    shareSymptomText?: string;
}

export function useNoteEditor(config: NoteEditorConfig) {
    const {
        algorithmOptions,
        cardStates,
        includeAlgorithm,
        dispositionType,
        dispositionText,
        selectedSymptom,
        visiblePages,
        isMobile,
        initialPage = 0,
        colors: _colors,
        includeDecisionMaking = false,
        shareSymptomText,
    } = config;

    const { profile } = useUserProfile();
    const authUserId = useAuthStore(s => s.user?.id);
    const defaultHPI = profile.noteIncludeHPI ?? true;
    const defaultPE = profile.noteIncludePE ?? false;

    // --- Note content state ---
    const [note, setNote] = useState('');
    const [previewNote, setPreviewNote] = useState('');
    const [includeHPI, setIncludeHPI] = useState(defaultHPI);
    const [peNote, setPeNote] = useState('');
    const [includePhysicalExam, setIncludePhysicalExam] = useState(defaultPE);
    const [encodedValue, setEncodedValue] = useState('');
    const [copiedTarget, setCopiedTarget] = useState<'preview' | 'encoded' | null>(null);

    // --- Page navigation state ---
    const [currentPage, setCurrentPage] = useState(() =>
        initialPage >= 3 ? visiblePages.length - 1 : Math.min(initialPage, visiblePages.length - 1)
    );
    const currentPageId: PageId = visiblePages[currentPage]?.id ?? visiblePages[0]?.id ?? 'hpi';
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');

    // --- Text expander ---
    const [cursorPosition, setCursorPosition] = useState(0);
    const textExpanders = profile.textExpanders ?? [];
    const textExpanderEnabled = profile.textExpanderEnabled ?? true;
    const { session: templateSession, stepStartRef, startSession, fillCurrentAndAdvance, dismissDropdown, selectNextChoice, selectPrevChoice, endSession } = useTemplateSession();
    const { suggestions: expanderSuggestions, selectedIndex: expanderIndex, accept: acceptExpander, dismiss: dismissExpander, selectNext: expanderNext, selectPrev: expanderPrev } = useTextExpander({
        text: note,
        cursorPosition,
        expanders: textExpanders,
        enabled: textExpanderEnabled && currentPageId === 'hpi' && !templateSession.isActive,
    });
    const hasExpanderSuggestion = expanderSuggestions.length > 0;

    // --- End template session on page change ---
    useEffect(() => {
        if (templateSession.isActive) endSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPageId]);

    // --- PII detection (debounced) ---
    const [piiWarnings, setPiiWarnings] = useState<string[]>([]);
    const [pePiiWarnings, setPePiiWarnings] = useState<string[]>([]);
    useEffect(() => {
        const id = window.setTimeout(() => setPiiWarnings(detectPII(note)), 400);
        return () => clearTimeout(id);
    }, [note]);
    useEffect(() => {
        const id = window.setTimeout(() => setPePiiWarnings(detectPII(peNote)), 400);
        return () => clearTimeout(id);
    }, [peNote]);
    const hasPII = piiWarnings.length > 0 || pePiiWarnings.length > 0;

    // --- Refs ---
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const currentPageRef = useRef(currentPage);
    currentPageRef.current = currentPage;

    // --- Hooks ---
    const { generateNote } = useNoteCapture(algorithmOptions, cardStates);
    const signature = formatSignature(profile);
    const { shareNote, shareStatus } = useNoteShare();
    const { exportDD689, exportStatus } = useDD689Export();

    // --- Copied state auto-revert ---
    useEffect(() => {
        if (copiedTarget) {
            const id = window.setTimeout(() => setCopiedTarget(null), UI_TIMING.COPY_FEEDBACK);
            return () => clearTimeout(id);
        }
    }, [copiedTarget]);

    // --- Auto-focus HPI textarea when navigating to HPI page ---
    useEffect(() => {
        if (currentPageId === 'hpi' && includeHPI) {
            setTimeout(() => inputRef.current?.focus(), UI_TIMING.AUTOFOCUS_DELAY);
        }
    }, [currentPageId, includeHPI]);

    // --- Preview note generation ---
    useEffect(() => {
        const result = generateNote(
            { includeAlgorithm, includeDecisionMaking, customNote: includeHPI ? note : '', physicalExamNote: includePhysicalExam ? peNote : '', signature },
            dispositionType,
            dispositionText,
            selectedSymptom,
        );
        setPreviewNote(result.fullNote);
    }, [note, includeDecisionMaking, includeHPI, peNote, includePhysicalExam, generateNote, dispositionType, dispositionText, selectedSymptom, signature, includeAlgorithm]);

    // --- Copy handler ---
    const handleCopy = useCallback((text: string, target: 'preview' | 'encoded') => {
        copyWithHtml(text);
        setCopiedTarget(target);
    }, []);

    // --- Share handler ---
    const handleShare = useCallback(() => {
        if (!encodedValue) return;
        shareNote({
            encodedText: encodedValue,
            symptomText: shareSymptomText ?? selectedSymptom?.text ?? 'Note',
            dispositionType,
            dispositionText,
        }, isMobile);
    }, [encodedValue, selectedSymptom, dispositionType, dispositionText, isMobile, shareNote, shareSymptomText]);

    // --- DD689 PDF export handler ---
    const handleExportDD689 = useCallback(() => {
        if (!encodedValue) return;
        const authorParts = [
            profile.lastName,
            profile.firstName,
            profile.middleInitial,
            profile.credential,
            profile.rank,
        ].filter(Boolean);
        exportDD689({
            encodedValue,
            dispositionType,
            dispositionText,
            symptomText: shareSymptomText ?? selectedSymptom?.text ?? 'Note',
            clinicName: profile.clinicName || '',
            authorLine: authorParts.length ? authorParts.join(', ') : undefined,
        });
    }, [encodedValue, dispositionType, dispositionText, selectedSymptom, exportDD689, profile, shareSymptomText]);

    // --- Slide animation helper ---
    const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
        setSlideDirection(direction);
        setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION);
    }, []);

    // --- Page navigation ---
    const handleNext = useCallback(() => {
        setCurrentPage(prev => {
            if (prev >= visiblePages.length - 1) return prev;
            handleSlideAnimation('left');
            return prev + 1;
        });
    }, [handleSlideAnimation, visiblePages.length]);

    const handlePageBack = useCallback(() => {
        setCurrentPage(prev => {
            if (prev <= 0) return prev;
            handleSlideAnimation('right');
            return prev - 1;
        });
    }, [handleSlideAnimation]);

    // --- Page swipe (mobile) ---
    const handleSwipeLeft = useCallback(() => {
        const page = currentPageRef.current;
        if (page < visiblePages.length - 1) {
            handleSlideAnimation('left');
            setCurrentPage(page + 1);
        }
    }, [handleSlideAnimation, visiblePages.length]);

    const handleSwipeRight = useCallback(() => {
        const page = currentPageRef.current;
        if (page > 0) {
            handleSlideAnimation('right');
            setCurrentPage(page - 1);
        }
    }, [handleSlideAnimation]);

    const { onTouchStart: handleSwipeStart, onTouchMove: handleSwipeMove, onTouchEnd: handleSwipeEnd } = usePageSwipe(
        handleSwipeLeft,
        handleSwipeRight,
        isMobile,
    );

    // --- HPI keyboard handler ---
    const hpiKeyDownHandler = useMemo(() => createHPIKeyDownHandler({
        inputRef,
        note,
        cursorPosition,
        setNote,
        setCursorPosition,
        templateSession,
        stepStartRef,
        fillCurrentAndAdvance,
        dismissDropdown,
        selectNextChoice,
        selectPrevChoice,
        endSession,
        startSession,
        expanderSuggestions,
        expanderIndex,
        acceptExpander,
        dismissExpander,
        expanderNext,
        expanderPrev,
        hasExpanderSuggestion,
    }), [
        note, cursorPosition, templateSession, stepStartRef,
        fillCurrentAndAdvance, dismissDropdown, selectNextChoice, selectPrevChoice,
        endSession, startSession, expanderSuggestions, expanderIndex,
        acceptExpander, dismissExpander, expanderNext, expanderPrev, hasExpanderSuggestion,
    ]);

    return {
        // Note state
        note, setNote, previewNote,
        peNote, setPeNote,
        includeHPI, setIncludeHPI,
        includePhysicalExam, setIncludePhysicalExam,
        encodedValue, setEncodedValue,
        copiedTarget, setCopiedTarget,

        // Page navigation
        currentPage, currentPageId, slideDirection,
        handleNext, handlePageBack, handleSlideAnimation,

        // Swipe
        handleSwipeLeft, handleSwipeRight,
        handleSwipeStart, handleSwipeMove, handleSwipeEnd,

        // Cursor
        cursorPosition, setCursorPosition,

        // PII
        piiWarnings, pePiiWarnings, hasPII,

        // Handlers
        handleCopy, handleShare, handleExportDD689,
        shareStatus, exportStatus,

        // Text expander
        expanderSuggestions, expanderIndex, acceptExpander, dismissExpander,
        expanderNext, expanderPrev, hasExpanderSuggestion,

        // Template session
        templateSession, stepStartRef, startSession, fillCurrentAndAdvance,
        dismissDropdown, selectNextChoice, selectPrevChoice, endSession,

        // HPI keyboard handler
        hpiKeyDownHandler,

        // Refs
        inputRef, currentPageRef,

        // Profile / auth data (for barcode)
        profile, authUserId, defaultHPI, defaultPE, signature, colors: _colors,
    };
}
