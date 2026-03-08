import { useState, useCallback, useMemo, useEffect } from 'react'
import { ArrowRightLeft, Edit3, Trash2 } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { PropertyPanel, type PropertyView } from './Property/PropertyPanel'
import { ContentWrapper } from './Settings/ContentWrapper'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import type { LocalPropertyItem } from '../Types/PropertyTypes'
import { UI_TIMING } from '../Utilities/constants'
import { usePropertyStore } from '../stores/usePropertyStore'

interface PropertyDrawerProps {
    isVisible: boolean
    onClose: () => void
}

export function PropertyDrawer({ isVisible, onClose }: PropertyDrawerProps) {
    const { resetLocationPath } = usePropertyStore()
    const [view, setView] = useState<PropertyView>('property')
    const [selectedPropertyItemName, setSelectedPropertyItemName] = useState<string | null>(null)
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')

    const [mobileLocationView, setMobileLocationView] = useState(false)

    // Callbacks for detail-view header actions (set by PropertyPanel)
    const [detailActions, setDetailActions] = useState<{
        onEdit: () => void
        onTransfer: () => void
        onDelete: () => void
    } | null>(null)

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
        setMobileLocationView(false)
        resetLocationPath()
        onClose()
    }, [onClose, resetLocationPath])

    const swipeHandlers = useSwipeBack(
        useMemo(() => {
            if (view === 'property') return undefined
            return handleBack
        }, [view, handleBack]),
        view !== 'property',
    )

    const detailHeaderActions = useMemo(() => {
        if (!detailActions) return undefined
        const { onEdit, onTransfer, onDelete } = detailActions
        if (isMobile) {
            // NavTop triple icon container pattern
            return (
                <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5">
                    <button onClick={onTransfer} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary transition-all duration-200" aria-label="Transfer">
                        <ArrowRightLeft className="w-6 h-6 stroke-current" />
                    </button>
                    <button onClick={onEdit} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary transition-all duration-200" aria-label="Edit">
                        <Edit3 className="w-6 h-6 stroke-current" />
                    </button>
                    <button onClick={onDelete} className="w-11 h-11 rounded-full flex items-center justify-center text-themeredred hover:text-themeredred/80 transition-all duration-200" aria-label="Delete">
                        <Trash2 className="w-6 h-6 stroke-current" />
                    </button>
                </div>
            )
        }
        // Desktop: compact pill buttons
        return (
            <div className="flex items-center gap-1.5">
                <button onClick={onTransfer} className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-themeblue3 text-white text-xs font-medium hover:bg-themeblue3/90 transition-colors">
                    <ArrowRightLeft size={16} /> Transfer
                </button>
                <button onClick={onEdit} className="flex items-center gap-1.5 h-8 px-3 rounded-full border border-tertiary/20 text-xs font-medium text-primary hover:bg-secondary/5 transition-colors">
                    <Edit3 size={16} /> Edit
                </button>
                <button onClick={onDelete} className="flex items-center justify-center h-8 w-8 rounded-full border border-themeredred/20 text-themeredred hover:bg-themeredred/10 transition-colors">
                    <Trash2 size={16} />
                </button>
            </div>
        )
    }, [detailActions, isMobile])

    const headerConfig = useMemo(() => {
        switch (view) {
            case 'property':
                if (isMobile && mobileLocationView) {
                    return { title: 'Property Book', showBack: true, onBack: () => { resetLocationPath(); setMobileLocationView(false) } }
                }
                return { title: 'Property Book' }
            case 'property-detail':
                return { title: selectedPropertyItemName ?? 'Item', showBack: true, onBack: handleBack, rightContent: detailHeaderActions }
            case 'property-transfer':
                return { title: 'Transfer Custody', showBack: true, onBack: handleBack }
            case 'property-form':
                return { title: selectedPropertyItemName ? 'Edit Item' : 'Add Item', showBack: true, onBack: handleBack }
        }
    }, [view, selectedPropertyItemName, handleBack, isMobile, mobileLocationView, detailHeaderActions, resetLocationPath])

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            fullHeight="90dvh"
            desktopPosition="left"
            desktopWidth="w-full"
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
                        mobileLocationView={mobileLocationView}
                        onMobileLocationViewChange={setMobileLocationView}
                        onRegisterDetailActions={setDetailActions}
                    />
                </div>
            </ContentWrapper>
        </BaseDrawer>
    )
}
