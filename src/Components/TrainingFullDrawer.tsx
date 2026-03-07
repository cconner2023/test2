import { useState, useCallback, useMemo } from 'react'
import { BaseDrawer } from './BaseDrawer'
import { TrainingPanel, type TrainingView } from './Settings/TrainingPanel'
import { ContentWrapper } from './Settings/ContentWrapper'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { stp68wTraining } from '../Data/TrainingTaskList'
import { getTaskData } from '../Data/TrainingData'
import type { subjectAreaArrayOptions } from '../Types/CatTypes'
import { UI_TIMING } from '../Utilities/constants'

interface TrainingFullDrawerProps {
    isVisible: boolean
    onClose: () => void
    initialTaskId?: string | null
}

export function TrainingFullDrawer({ isVisible, onClose, initialTaskId }: TrainingFullDrawerProps) {
    const [view, setView] = useState<TrainingView>('training')
    const [selectedTask, setSelectedTask] = useState<subjectAreaArrayOptions | null>(null)
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')

    const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
        setSlideDirection(direction)
        setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION)
    }, [])

    // Deep-link: resolve initialTaskId on open
    const resolvedInitial = useMemo(() => {
        if (!initialTaskId || !getTaskData(initialTaskId)) return null
        for (let levelIdx = 0; levelIdx < stp68wTraining.length; levelIdx++) {
            const level = stp68wTraining[levelIdx]
            for (let areaIdx = 0; areaIdx < level.subjectArea.length; areaIdx++) {
                const area = level.subjectArea[areaIdx]
                const taskIdx = area.tasks.findIndex(t => t.id === initialTaskId)
                if (taskIdx !== -1) {
                    const task = area.tasks[taskIdx]
                    return {
                        id: taskIdx,
                        icon: task.id,
                        text: task.title,
                        isParent: false,
                        parentId: areaIdx,
                    } as subjectAreaArrayOptions
                }
            }
        }
        return null
    }, [initialTaskId])

    // Apply deep-link when drawer opens
    const appliedInitialRef = useMemo(() => {
        if (isVisible && resolvedInitial) {
            setSelectedTask(resolvedInitial)
            setView('training-detail')
            setSlideDirection('')
            return true
        }
        return false
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVisible, resolvedInitial])

    const handleSelectTask = useCallback((task: subjectAreaArrayOptions) => {
        setSelectedTask(task)
        handleSlideAnimation('left')
        setView('training-detail')
    }, [handleSlideAnimation])

    const handleBack = useCallback(() => {
        if (view === 'training-detail') {
            handleSlideAnimation('right')
            setView('training')
            setSelectedTask(null)
        }
    }, [view, handleSlideAnimation])

    const handleClose = useCallback(() => {
        setView('training')
        setSelectedTask(null)
        setSlideDirection('')
        onClose()
    }, [onClose])

    const swipeHandlers = useSwipeBack(
        useMemo(() => {
            if (view === 'training') return undefined
            return handleBack
        }, [view, handleBack]),
        view !== 'training',
    )

    const headerConfig = useMemo(() => {
        if (view === 'training-detail') {
            return { title: selectedTask?.text || 'Task', showBack: true, onBack: handleBack }
        }
        return { title: 'My Training' }
    }, [view, selectedTask, handleBack])

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            fullHeight="90dvh"
            desktopPosition="left"
            header={headerConfig}
        >
            <ContentWrapper slideDirection={slideDirection} swipeHandlers={view !== 'training' ? swipeHandlers : undefined}>
                <TrainingPanel
                    view={view}
                    selectedTask={selectedTask}
                    onSelectTask={handleSelectTask}
                />
            </ContentWrapper>
        </BaseDrawer>
    )
}
