// hooks/useActiveNote.ts
// Manages active note tracking, saving, deleting, updating, importing,
// restoring, feedback modals, and related navigation side effects.

import { useState, useCallback, useRef, useEffect } from 'react'
import { createLogger } from '../Utilities/Logger'
import { encodedContentEquals } from '../Utilities/NoteCodec'
import { UI_TIMING } from '../Utilities/constants'

const logger = createLogger('ActiveNote')
import type { CardState } from './useAlgorithm'
import type { dispositionType } from '../Types/AlgorithmTypes'
import type { WriteNoteData } from './useNavigation'
import type { NoteSaveData } from '../Components/WriteNotePage'
import type { ImportSuccessData } from '../Components/NoteImport'
import type { SavedNote } from './useNotesStorage'
import type { useNavigation } from './useNavigation'
import type { useNotesStorage } from './useNotesStorage'
import type { NoteRestoreResult } from './useNoteRestore'

interface UseActiveNoteParams {
  navigation: ReturnType<typeof useNavigation>
  notesStorage: ReturnType<typeof useNotesStorage>
  restoreNote: (note: SavedNote) => NoteRestoreResult
  initialViewParam: string | null
  postUpdateNav: string | null
}

/**
 * Orchestrates active note tracking, CRUD operations, import/restore flows,
 * feedback modals, and navigation side effects for note management.
 */
export function useActiveNote({
  navigation,
  notesStorage,
  restoreNote,
  initialViewParam,
  postUpdateNav,
}: UseActiveNoteParams) {
  // ── Import flow state ──────────────────────────────────────
  const [importInitialView, setImportInitialView] = useState<'input' | 'scanning' | undefined>(
    initialViewParam === 'import' ? 'scanning' : undefined
  )
  const importWasOpenedRef = useRef(false)

  // ── Feedback modal state ───────────────────────────────────
  const [showImportSuccessModal, setShowImportSuccessModal] = useState(false)
  const [showImportDuplicateModal, setShowImportDuplicateModal] = useState(false)
  const [showNoteSavedModal, setShowNoteSavedModal] = useState(false)

  // ── Settings targeting state ───────────────────────────────
  const [myNotesInitialSelectedId, setMyNotesInitialSelectedId] = useState<string | null>(null)
  const [settingsInitialPanel, setSettingsInitialPanel] = useState<'main' | 'my-notes' | 'release-notes' | 'training'>('main')
  const [initialTrainingTaskId, setInitialTrainingTaskId] = useState<string | null>(null)

  // ── Storage error state ────────────────────────────────────
  const [storageError, setStorageError] = useState<string | null>(null)
  const clearStorageError = useCallback(() => setStorageError(null), [])

  // ── Active note tracking ───────────────────────────────────
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [activeNoteEncodedText, setActiveNoteEncodedText] = useState<string | null>(null)
  const [activeNoteSource, setActiveNoteSource] = useState<string | null>(null)
  const activeNoteIdRef = useRef<string | null>(null)

  // ── Algorithm restore state ────────────────────────────────
  const [restoredAlgorithmState, setRestoredAlgorithmState] = useState<{
    cardStates: CardState[];
    disposition: dispositionType | null;
  } | null>(null)
  const [algorithmKeySuffix, setAlgorithmKeySuffix] = useState('fresh')

  // ── Effects ────────────────────────────────────────────────

  // PWA App Shortcut / Post-update: open the appropriate view on mount
  useEffect(() => {
    if (postUpdateNav === 'release-notes') {
      setSettingsInitialPanel('release-notes')
      navigation.setShowSettings(true)
    } else if (initialViewParam === 'mynotes') {
      setSettingsInitialPanel('my-notes')
      navigation.setShowSettings(true)
    } else if (initialViewParam === 'import') {
      navigation.setShowNoteImport(true)
    } else if (initialViewParam === 'training') {
      setSettingsInitialPanel('training')
      navigation.setShowSettings(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run only once on mount

  // Clear the import initial view state when the import drawer is closed
  // so subsequent opens from the Import Note button use the default 'input' view
  useEffect(() => {
    if (navigation.showNoteImport) {
      importWasOpenedRef.current = true
    } else if (importWasOpenedRef.current && importInitialView) {
      setImportInitialView(undefined)
    }
  }, [navigation.showNoteImport, importInitialView])

  // When WriteNote closes, only clear the encoded text reference (not the note ID/source/algorithm state)
  // This preserves the algorithm state and note status badge on the algorithm page
  useEffect(() => {
    if (!navigation.isWriteNoteVisible) {
      setActiveNoteEncodedText(null)
    }
  }, [navigation.isWriteNoteVisible])

  // Clear ALL active note tracking when navigating away from the algorithm view
  // (e.g., going back to subcategories or categories)
  useEffect(() => {
    if (!navigation.showQuestionCard) {
      setActiveNoteId(null)
      setActiveNoteEncodedText(null)
      setActiveNoteSource(null)
      setRestoredAlgorithmState(null)
      setAlgorithmKeySuffix('fresh')
    }
  }, [navigation.showQuestionCard])

  // ── Handlers ───────────────────────────────────────────────

  // Expand note from algorithm page — injects HPI text from existing saved note when available
  const handleExpandNote = useCallback((data: WriteNoteData) => {
    if (activeNoteId && activeNoteEncodedText) {
      // We have an existing saved note — restore HPI text from the encoded data
      const tempNote: SavedNote = { id: activeNoteId, encodedText: activeNoteEncodedText, createdAt: '', symptomIcon: '', symptomText: '', dispositionType: '', dispositionText: '', previewText: '', sync_status: 'synced', authorId: '', authorName: null }
      const result = restoreNote(tempNote)
      if (result.success && (result.hpiText || result.peText)) {
        navigation.showWriteNote({ ...data, initialHpiText: result.hpiText, initialPeText: result.peText })
        return
      }
    }
    navigation.showWriteNote(data)
  }, [activeNoteId, activeNoteEncodedText, restoreNote, navigation])

  // Note save handler (new note)
  const handleNoteSave = useCallback((data: NoteSaveData): boolean => {
    const result = notesStorage.saveNote({
      encodedText: data.encodedText,
      previewText: data.previewText,
      symptomIcon: data.symptomIcon,
      symptomText: data.symptomText,
      dispositionType: data.dispositionType,
      dispositionText: data.dispositionText,
    })
    // After saving, track the new note so the button changes to "Delete Note"
    // and the note status badge appears on the algorithm page
    if (result.success && result.noteId) {
      setActiveNoteId(result.noteId)
      setActiveNoteEncodedText(data.encodedText)
      setActiveNoteSource('device')
      activeNoteIdRef.current = result.noteId
      return true
    }
    // Show error toast when save fails (e.g., quota exceeded)
    setStorageError(result.error || 'Failed to save note. Storage may be full.')
    return false
  }, [notesStorage])

  // Note delete handler (from WriteNotePage)
  const handleNoteDelete = useCallback((noteId: string) => {
    notesStorage.deleteNote(noteId)
    setActiveNoteId(null)
    setActiveNoteEncodedText(null)
  }, [notesStorage])

  // Note update handler (save changes to existing note)
  // When an external note is edited and re-saved, it becomes a normal saved note (source cleared)
  const handleNoteUpdate = useCallback((noteId: string, data: NoteSaveData): boolean => {
    const result = notesStorage.updateNote(noteId, {
      encodedText: data.encodedText,
      previewText: data.previewText,
      symptomIcon: data.symptomIcon,
      symptomText: data.symptomText,
      dispositionType: data.dispositionType,
      dispositionText: data.dispositionText,
      source: undefined, // Clear external source tag — edited notes become normal saved notes
    }, true) // refreshTimestamp = true
    if (result.success) {
      // Update the tracked encoded text and source to reflect the change
      setActiveNoteEncodedText(data.encodedText)
      setActiveNoteSource('device') // External notes become normal on re-save
      return true
    }
    // Show error toast when update fails
    setStorageError(result.error || 'Failed to update note. Storage may be full.')
    return false
  }, [notesStorage])

  // After-save navigation — closes WriteNote, resets columns, shows modal, opens Settings → My Notes
  const handleAfterSave = useCallback(() => {
    const noteId = activeNoteIdRef.current
    navigation.closeWriteNote()

    setShowNoteSavedModal(true)
    setTimeout(() => setShowNoteSavedModal(false), UI_TIMING.FEEDBACK_DURATION)

    // Reset navigation behind Settings overlay so columns return to main when Settings closes
    setTimeout(() => {
      navigation.resetToMain()
      setMyNotesInitialSelectedId(noteId)
      setSettingsInitialPanel('my-notes')
      navigation.setShowSettings(true)
    }, UI_TIMING.SLIDE_ANIMATION)
  }, [navigation])

  // Shared helper: restore a saved note → navigate to its algorithm → open WriteNote
  // Optional `deriveOverrides` callback receives the restore result to compute WriteNoteData overrides.
  const restoreAndOpenNote = useCallback((
    note: SavedNote,
    deriveOverrides?: (result: ReturnType<typeof restoreNote>) => Partial<WriteNoteData>
  ) => {
    const result = restoreNote(note)
    if (!result.success || !result.writeNoteData || !result.symptom || !result.category) {
      logger.warn('Failed to restore note:', result.error)
      return
    }

    // Track which saved note we're viewing/editing
    setActiveNoteId(note.id)
    setActiveNoteEncodedText(note.encodedText)
    setActiveNoteSource(note.source || 'device')
    setAlgorithmKeySuffix(`restored-${note.id}`)

    // Store restored algorithm state so AlgorithmPage can be pre-filled
    setRestoredAlgorithmState({
      cardStates: result.writeNoteData.cardStates,
      disposition: result.writeNoteData.disposition
    })

    // 1. Navigate to the algorithm view for this symptom
    navigation.handleNavigation({
      type: 'CC',
      id: result.symptom.id,
      icon: result.symptom.icon,
      text: result.symptom.text,
      data: {
        categoryId: result.category.id,
        symptomId: result.symptom.id,
        categoryRef: result.category,
        symptomRef: result.symptom
      }
    })

    // 2. Close Settings drawer (My Notes lives inside Settings)
    navigation.setShowSettings(false)

    // 3. Open WriteNote wizard — synchronous so all state changes batch into one render.
    //    This prevents Column A from briefly showing the wrong panel during the transition.
    const overrides = deriveOverrides?.(result)
    const noteData = overrides
      ? { ...result.writeNoteData, ...overrides }
      : result.writeNoteData
    navigation.showWriteNote(noteData)
  }, [restoreNote, navigation])

  // View note handler — restore and open WriteNote at the View Note panel (page 1)
  const handleViewNote = useCallback((note: SavedNote) => {
    restoreAndOpenNote(note, (result) => ({
      initialPage: 3,
      initialHpiText: result.hpiText || '',
      initialPeText: result.peText || '',
      timestamp: result.timestamp,
    }))
  }, [restoreAndOpenNote])

  // Import success handler — checks for duplicates (personal + clinic), saves imported note with 'external source' tag, then opens My Notes
  const handleImportSuccess = useCallback((data: ImportSuccessData) => {
    // Check for duplicate in personal notes (ignore volatile segments like timestamp, userId, clinicId)
    const existingPersonal = notesStorage.notes.find(n => encodedContentEquals(n.encodedText, data.encodedText))

    if (existingPersonal) {
      // Duplicate found in personal notes — navigate to My Notes with it pre-selected
      navigation.setShowNoteImport(false)
      setShowImportDuplicateModal(true)
      setTimeout(() => setShowImportDuplicateModal(false), UI_TIMING.FEEDBACK_DURATION)
      setTimeout(() => {
        setMyNotesInitialSelectedId(existingPersonal.id)
        setSettingsInitialPanel('my-notes')
        navigation.setShowSettings(true)
      }, UI_TIMING.SLIDE_ANIMATION)
      return
    }

    // Check for duplicate in clinic notes (ignore volatile segments like timestamp, userId, clinicId)
    const existingClinic = notesStorage.clinicNotes.find(n => encodedContentEquals(n.encodedText, data.encodedText))

    if (existingClinic) {
      // Duplicate found in clinic notes — show duplicate modal but don't navigate to My Notes
      navigation.setShowNoteImport(false)
      setShowImportDuplicateModal(true)
      setTimeout(() => setShowImportDuplicateModal(false), UI_TIMING.FEEDBACK_DURATION)
      return
    }

    // Use preview data from the rich review UI when available
    const preview = data.preview
    const authorLabel = preview?.authorLabel
    const externalSource = authorLabel && authorLabel !== 'Unknown'
      ? `external:${authorLabel}`
      : 'external'

    // Build a temporary SavedNote-like object to use restoreNote
    const tempNote: SavedNote = {
      id: '',
      encodedText: data.encodedText,
      createdAt: new Date().toISOString(),
      symptomIcon: preview?.symptomIcon || '',
      symptomText: preview?.symptomText || '',
      dispositionType: preview?.dispositionType || '',
      dispositionText: preview?.dispositionText || '',
      previewText: data.decodedText.slice(0, 200),
      source: externalSource,
      sync_status: 'pending',
      authorId: '',
      authorName: null,
    }

    // Restore note to get algorithm state + symptom/category info
    const result = restoreNote(tempNote)
    if (!result.success || !result.writeNoteData || !result.symptom || !result.category) {
      logger.warn('Failed to restore imported note:', result.error)
      return
    }

    // 1. Save the note to storage with external source tag
    //    Pass originating_clinic_id from the barcode's C segment
    const disposition = result.writeNoteData.disposition
    const originatingClinicId = preview?.clinicId ?? null
    const saveResult = notesStorage.saveNote({
      encodedText: data.encodedText,
      previewText: data.decodedText.slice(0, 200),
      symptomIcon: result.symptom.icon || '',
      symptomText: result.symptom.text || 'Imported Note',
      dispositionType: disposition.type,
      dispositionText: disposition.text,
      source: externalSource,
    }, {
      originating_clinic_id: originatingClinicId,
      timestamp: preview?.timestamp?.toISOString(),
    })

    if (!saveResult.success) {
      // Show error toast instead of success modal
      setStorageError(saveResult.error || 'Failed to import note. Storage may be full.')
      navigation.setShowNoteImport(false)
      return
    }

    // 2. Close Import drawer
    navigation.setShowNoteImport(false)

    // 3. Show success feedback modal
    setShowImportSuccessModal(true)
    setTimeout(() => setShowImportSuccessModal(false), UI_TIMING.FEEDBACK_DURATION)

    // 4. Open Settings → My Notes so the user can decide what to do with the imported note
    setTimeout(() => {
      setMyNotesInitialSelectedId(null)
      setSettingsInitialPanel('my-notes')
      navigation.setShowSettings(true)
    }, UI_TIMING.SLIDE_ANIMATION)
  }, [restoreNote, notesStorage, navigation])

  // Open Settings -> Training -> specific task (desktop only)
  const openTrainingTask = useCallback((taskId: string) => {
    setSettingsInitialPanel('training')
    setInitialTrainingTaskId(taskId)
  }, [])

  // Reset settings panel (used when Settings drawer closes)
  const resetSettingsPanel = useCallback(() => {
    setSettingsInitialPanel('main')
    setMyNotesInitialSelectedId(null)
    setInitialTrainingTaskId(null)
  }, [])

  return {
    // Active note state
    activeNoteId,
    activeNoteEncodedText,
    activeNoteSource,
    algorithmKeySuffix,
    restoredAlgorithmState,

    // Feedback modal state
    showImportSuccessModal,
    showImportDuplicateModal,
    showNoteSavedModal,

    // Import state
    importInitialView,

    // Settings targeting
    settingsInitialPanel,
    myNotesInitialSelectedId,
    initialTrainingTaskId,

    // Storage error
    storageError,
    clearStorageError,

    // Handlers
    handleExpandNote,
    handleNoteSave,
    handleNoteDelete,
    handleNoteUpdate,
    handleAfterSave,
    handleViewNote,
    handleImportSuccess,
    resetSettingsPanel,
    openTrainingTask,
  }
}
