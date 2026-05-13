import { useCallback, useMemo, useState } from 'react'

export interface DetailEditState {
  editing: boolean
  setEditing: (v: boolean) => void
  saveRequested: boolean
  requestSave: () => void
  completeSave: () => void
  hasPending: boolean
  setHasPending: (v: boolean) => void
  confirmingDelete: boolean
  requestDelete: () => void
  cancelDelete: () => void
  deleteProcessing: boolean
  performDelete: (fn: () => Promise<{ success: boolean }>) => Promise<boolean>
  reset: () => void
}

export function useDetailEditState(): DetailEditState {
  const [editing, setEditing] = useState(false)
  const [saveRequested, setSaveRequested] = useState(false)
  const [hasPending, setHasPending] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteProcessing, setDeleteProcessing] = useState(false)

  const requestSave = useCallback(() => setSaveRequested(true), [])
  const completeSave = useCallback(() => setSaveRequested(false), [])
  const requestDelete = useCallback(() => setConfirmingDelete(true), [])
  const cancelDelete = useCallback(() => setConfirmingDelete(false), [])

  const performDelete = useCallback(async (fn: () => Promise<{ success: boolean }>) => {
    setDeleteProcessing(true)
    const result = await fn()
    setDeleteProcessing(false)
    setConfirmingDelete(false)
    return result.success
  }, [])

  const reset = useCallback(() => {
    setEditing(false)
    setSaveRequested(false)
    setHasPending(false)
    setConfirmingDelete(false)
  }, [])

  // Stable object identity — consumers thread this into useCallback deps, so
  // recreating it every render would cascade memoization invalidations.
  return useMemo(
    () => ({
      editing,
      setEditing,
      saveRequested,
      requestSave,
      completeSave,
      hasPending,
      setHasPending,
      confirmingDelete,
      requestDelete,
      cancelDelete,
      deleteProcessing,
      performDelete,
      reset,
    }),
    [
      editing,
      saveRequested,
      hasPending,
      confirmingDelete,
      deleteProcessing,
      requestSave,
      completeSave,
      requestDelete,
      cancelDelete,
      performDelete,
      reset,
    ],
  )
}
