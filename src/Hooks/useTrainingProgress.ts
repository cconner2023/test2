import { useState, useCallback, useEffect } from 'react'
import type { subjectAreaArray } from '../Types/CatTypes'
import { getTaskData } from '../Data/TrainingData'

interface TaskProgress {
    lastViewedAt: string
    lastStepIndex: number
    completed: boolean
}

interface TrainingProgress {
    viewedTasks: Record<string, TaskProgress>
}

const STORAGE_KEY = 'adtmc_training_progress'

function loadProgress(): TrainingProgress {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return { viewedTasks: {} }
        const parsed = JSON.parse(raw)
        if (typeof parsed?.viewedTasks === 'object') return parsed
        return { viewedTasks: {} }
    } catch {
        return { viewedTasks: {} }
    }
}

function persistProgress(progress: TrainingProgress): boolean {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
        return true
    } catch {
        return false
    }
}

export function useTrainingProgress() {
    const [progress, setProgress] = useState<TrainingProgress>(() => loadProgress())

    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) setProgress(loadProgress())
        }
        window.addEventListener('storage', handleStorage)
        return () => window.removeEventListener('storage', handleStorage)
    }, [])

    const markTaskViewed = useCallback((taskNumber: string, stepIndex: number) => {
        const current = loadProgress()
        const existing = current.viewedTasks[taskNumber]
        current.viewedTasks[taskNumber] = {
            lastViewedAt: new Date().toISOString(),
            lastStepIndex: stepIndex,
            completed: existing?.completed ?? false,
        }
        persistProgress(current)
        setProgress(current)
    }, [])

    const markTaskCompleted = useCallback((taskNumber: string) => {
        const current = loadProgress()
        current.viewedTasks[taskNumber] = {
            ...current.viewedTasks[taskNumber],
            lastViewedAt: new Date().toISOString(),
            lastStepIndex: current.viewedTasks[taskNumber]?.lastStepIndex ?? 0,
            completed: true,
        }
        persistProgress(current)
        setProgress(current)
    }, [])

    const isTaskCompleted = useCallback((taskNumber: string) => {
        return progress.viewedTasks[taskNumber]?.completed ?? false
    }, [progress])

    const isTaskViewed = useCallback((taskNumber: string) => {
        return taskNumber in progress.viewedTasks
    }, [progress])

    const getLastStep = useCallback((taskNumber: string) => {
        return progress.viewedTasks[taskNumber]?.lastStepIndex ?? 0
    }, [progress])

    const getSubjectAreaProgress = useCallback((subjectArea: subjectAreaArray) => {
        const tasks = subjectArea.options
        let viewed = 0
        let completed = 0
        for (const task of tasks) {
            const hasData = !!getTaskData(task.icon)
            if (!hasData) continue
            if (progress.viewedTasks[task.icon]) viewed++
            if (progress.viewedTasks[task.icon]?.completed) completed++
        }
        const total = tasks.filter(t => !!getTaskData(t.icon)).length
        return { viewed, completed, total }
    }, [progress])

    return {
        progress,
        markTaskViewed,
        markTaskCompleted,
        isTaskCompleted,
        isTaskViewed,
        getLastStep,
        getSubjectAreaProgress,
    }
}
