import { useState, useCallback, useMemo, useEffect } from 'react'
import { BaseDrawer } from './BaseDrawer'
import { PropertyPanel, type PropertyView } from './Property/PropertyPanel'
import { ContentWrapper } from './Settings/ContentWrapper'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import type { LocalPropertyItem } from '../Types/PropertyTypes'
import { UI_TIMING } from '../Utilities/constants'

interface PropertyDrawerProps {
    isVisible: boolean
    onClose: () => void
}

export function PropertyDrawer({ isVisible, onClose }: PropertyDrawerProps) {
    const [view, setView] = useState<PropertyView>('property')
    const [selectedPropertyItemName, setSelectedPropertyItemName] = useState<string | null>(null)
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')

    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    )
    useEffect(() => {
        const mql = window.matchMedia('(max-width: 767px)')
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
    }, [])

    const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
        setSlideDirection(direction)
        setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION)
    }, [])

    const handleSelectItem = useCallback((item: LocalPropertyItem) => {
        setSelectedPropertyItemName(item.name)
        handleSlideAnimation('left')
        setView('property-detail')
    }, [handleSlideAnimation])

    const handleAddItem = useCallback(() => {
        setSelectedPropertyItemName(null)
        handleSlideAnimation('left')
        setView('property-form')
    }, [handleSlideAnimation])

    const handleEditItem = useCallback((item: LocalPropertyItem) => {
        setSelectedPropertyItemName(item.name)
        handleSlideAnimation('left')
        setView('property-form')
    }, [handleSlideAnimation])

    const handleTransfer = useCallback(() => {
        handleSlideAnimation('left')
        setView('property-transfer')
    }, [handleSlideAnimation])

    const handleBack = useCallback(() => {
        if (view === 'property-transfer') {
            handleSlideAnimation('right')
            setView('property-detail')
        } else if (view === 'property-detail' || view === 'property-form') {
            handleSlideAnimation('right')
            setView('property')
            setSelectedPropertyItemName(null)
        }
    }, [view, handleSlideAnimation])

    const handleClose = useCallback(() => {
        setView('property')
        setSelectedPropertyItemName(null)
        setSlideDirection('')
        onClose()
    }, [onClose])

    const swipeHandlers = useSwipeBack(
        useMemo(() => {
            if (view === 'property') return undefined
            return handleBack
        }, [view, handleBack]),
        view !== 'property',
    )

    const headerConfig = useMemo(() => {
        switch (view) {
            case 'property':
                return { title: 'Property Book' }
            case 'property-detail':
                return { title: selectedPropertyItemName ?? 'Item', showBack: true, onBack: handleBack }
            case 'property-transfer':
                return { title: 'Transfer Custody', showBack: true, onBack: handleBack }
            case 'property-form':
                return { title: selectedPropertyItemName ? 'Edit Item' : 'Add Item', showBack: true, onBack: handleBack }
        }
    }, [view, selectedPropertyItemName, handleBack])

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            fullHeight="90dvh"
            desktopPosition="left"
            desktopWidth="w-[70%]"
            header={headerConfig}
        >
            <ContentWrapper slideDirection={isMobile ? slideDirection : ''} swipeHandlers={isMobile && view !== 'property' ? swipeHandlers : undefined}>
                <div className="h-full relative">
                    <PropertyPanel
                        isMobile={isMobile}
                        view={view}
                        onSelectItem={handleSelectItem}
                        onAddItem={handleAddItem}
                        onEditItem={handleEditItem}
                        onTransferItem={handleTransfer}
                        onBack={handleBack}
                    />
                </div>
            </ContentWrapper>
        </BaseDrawer>
    )
}
