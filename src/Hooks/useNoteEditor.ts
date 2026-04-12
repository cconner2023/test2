import { useState, useEffect, useRef, useCallback } from 'react';
import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { PEState } from '../Types/PETypes';
import type { CardState } from './useAlgorithm';
import { useNoteCapture } from './useNoteCapture';
import { useNoteShare } from './useNoteShare';
import { useDD689Export } from './useDD689Export';
import { useSF600Export } from './useSF600Export';
import { useUserProfile } from './useUserProfile';
import { useAuthStore } from '../stores/useAuthStore';
import { usePageSwipe } from './usePageSwipe';
import { detectPII } from '../lib/piiDetector';
import { formatSignature } from '../Utilities/NoteFormatter';
import { getColorClasses } from '../Utilities/ColorUtilities';
import { UI_TIMING } from '../Utilities/constants';
import { copyWithHtml } from '../Utilities/clipboardUtils';

type PageId = string;

export interface NoteEditorConfig {
    algorithmOptions: AlgorithmOptions[];
    cardStates: CardState[];
    includeAlgorithm: boolean;
    includeDecisionMaking?: boolean;
    dispositionType: string;
    dispositionText: string;
    selectedSymptom?: { icon: string; text: string };
    visiblePages: { id: string; label: string }[];
    isMobile: boolean;
    initialPage?: number;
    colors: ReturnType<typeof getColorClasses>;
    // Optional — WriteNotePage manages these externally
    shareSymptomText?: string;
}

export function useNoteEditor(config: NoteEditorConfig) {
    const {
        algorithmOptions,
        cardStates,
        includeAlgorithm,
        includeDecisionMaking = true,
        dispositionType,
        dispositionText,
        selectedSymptom,
        visiblePages,
        isMobile,
        initialPage = 0,
        colors: _colors,
        shareSymptomText,
    } = config;

    const { profile } = useUserProfile();
    const authUserId = useAuthStore(s => s.user?.id);

    // --- Note content state ---
    const [note, setNote] = useState('');
    const [previewNote, setPreviewNote] = useState('');
    const [peNote, setPeNote] = useState('');
    const [peState, setPeState] = useState<PEState | null>(null);
    const [planNote, setPlanNote] = useState('');
    const [selectedDdx, setSelectedDdx] = useState<string[]>([]);
    const [customDdx, setCustomDdx] = useState<string[]>([]);
    const [encodedValue, setEncodedValue] = useState('');
    const [copiedTarget, setCopiedTarget] = useState<'preview' | 'encoded' | null>(null);

    // --- Page navigation state ---
    const [currentPage, setCurrentPage] = useState(() =>
        initialPage >= 3 ? visiblePages.length - 1 : Math.min(initialPage, visiblePages.length - 1)
    );
    const currentPageId: PageId = visiblePages[currentPage]?.id ?? visiblePages[0]?.id ?? 'edit';
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');

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
    const currentPageRef = useRef(currentPage);
    currentPageRef.current = currentPage;

    // --- Hooks ---
    const { generateNote } = useNoteCapture(algorithmOptions, cardStates);
    const signature = formatSignature(profile);
    const { shareNote, shareStatus } = useNoteShare();
    const { exportDD689, exportStatus, dd689Preview, downloadDD689, clearDD689Preview } = useDD689Export();
    const { exportSF600, sf600ExportStatus, sf600Preview, downloadSF600, clearSF600Preview } = useSF600Export();

    // --- Copied state auto-revert ---
    useEffect(() => {
        if (copiedTarget) {
            const id = window.setTimeout(() => setCopiedTarget(null), UI_TIMING.COPY_FEEDBACK);
            return () => clearTimeout(id);
        }
    }, [copiedTarget]);

    // --- Preview note generation ---
    useEffect(() => {
        const result = generateNote(
            { includeAlgorithm, includeDecisionMaking, selectedDdx, customDdx, customNote: note, physicalExamNote: peNote, planNote },
            dispositionType,
            dispositionText,
            selectedSymptom,
        );
        setPreviewNote(result.fullNote);
    }, [note, selectedDdx, customDdx, peNote, planNote, generateNote, dispositionType, dispositionText, selectedSymptom, includeAlgorithm, includeDecisionMaking]);

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

    // --- SF600 PDF export handler ---
    const handleExportSF600 = useCallback(() => {
        if (!previewNote) return;
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
        const nameParts = [profile.lastName, profile.firstName, profile.middleInitial].filter(Boolean).join(' ');
        const suffix = [profile.credential, profile.rank, profile.component].filter(Boolean).join(', ');
        const sigName = suffix ? `${nameParts} ${suffix}` : nameParts;
        exportSF600({
            noteText: previewNote,
            date: dateStr,
            signatureName: sigName || undefined,
        });
    }, [previewNote, exportSF600]);

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

    return {
        // Note state
        note, setNote, previewNote,
        peNote, setPeNote,
        peState, setPeState,
        planNote, setPlanNote,
        selectedDdx, setSelectedDdx,
        customDdx, setCustomDdx,
        encodedValue, setEncodedValue,
        copiedTarget, setCopiedTarget,

        // Page navigation
        currentPage, currentPageId, slideDirection,
        handleNext, handlePageBack, handleSlideAnimation,

        // Swipe
        handleSwipeLeft, handleSwipeRight,
        handleSwipeStart, handleSwipeMove, handleSwipeEnd,

        // PII
        piiWarnings, pePiiWarnings, hasPII,

        // Handlers
        handleCopy, handleShare, handleExportDD689, handleExportSF600,
        shareStatus, exportStatus, sf600ExportStatus,
        dd689Preview, downloadDD689, clearDD689Preview,
        sf600Preview, downloadSF600, clearSF600Preview,

        // Refs
        currentPageRef,

        // Profile / auth data (for barcode)
        profile, authUserId, signature, colors: _colors,
    };
}
