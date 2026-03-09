import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { ArrowRightLeft, Edit3, Trash2, Plus, FolderPlus, X } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { PropertyPanel, type PropertyView } from './Property/PropertyPanel'
import { ContentWrapper } from './Settings/ContentWrapper'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import type { LocalPropertyItem } from '../Types/PropertyTypes'
import type { LocationEditActions } from './Property/PropertyLocationMap'
import { UI_TIMING } from '../Utilities/constants'
import { usePropertyStore } from '../stores/usePropertyStore'

interface PropertyDrawerProps {
    isVisible: boolean
    onClose: () => void
}

export function PropertyDrawer({ isVisible, onClose }: PropertyDrawerProps) {
    const { selectZone, setDefaultLocationId, setEditingItem } = usePropertyStore()
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

    // Callbacks for canvas location edit/delete (set by PropertyLocationMap via PropertyPanel)
    const [locationActions, setLocationActions] = useState<LocationEditActions | null>(null)

    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    )
    useEffect(() => {
        const mql = window.matchMedia('(max-width: 767px)')
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
    }, [])

    // Ref to trigger the add-location form inside PropertyPanel from the header
    const addLocationTriggerRef = useRef<(() => void) | null>(null)

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
        selectZone(null)
        onClose()
    }, [onClose, selectZone])

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
            // NavTop quadruple icon container: transfer + edit + delete + close
            return (
                <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5">
                    <button onClick={onTransfer} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="Transfer">
                        <ArrowRightLeft className="w-[18px] h-[18px]" />
                    </button>
                    <button onClick={onEdit} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="Edit">
                        <Edit3 className="w-[18px] h-[18px]" />
                    </button>
                    <button onClick={onDelete} className="w-11 h-11 rounded-full flex items-center justify-center text-themeredred hover:text-themeredred/80 active:scale-95 transition-all duration-200" aria-label="Delete">
                        <Trash2 className="w-[18px] h-[18px]" />
                    </button>
                    <button onClick={handleClose} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="Close">
                        <X className="w-[18px] h-[18px]" />
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
    }, [detailActions, isMobile, handleClose])

    // Triple pill for the mobile main property view (new item + new location + close)
    const mainHeaderActions = useMemo(() => {
        if (!isMobile) return undefined
        return (
            <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5">
                <button
                    onClick={() => {
                        setDefaultLocationId(null)
                        setEditingItem(null)
                        handleAddItem()
                    }}
                    className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200"
                    aria-label="New item"
                >
                    <Plus className="w-[18px] h-[18px]" />
                </button>
                <button
                    onClick={() => addLocationTriggerRef.current?.()}
                    className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200"
                    aria-label="New location"
                >
                    <FolderPlus className="w-[18px] h-[18px]" />
                </button>
                <button
                    onClick={handleClose}
                    className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200"
                    aria-label="Close"
                >
                    <X className="w-[18px] h-[18px]" />
                </button>
            </div>
        )
    }, [isMobile, handleAddItem, handleClose, setDefaultLocationId, setEditingItem])

    // Header actions for the canvas location view (edit/delete current location)
    const locationHeaderActions = useMemo(() => {
        if (!locationActions) return undefined
        if (isMobile) {
            return (
                <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5">
                    <button onClick={locationActions.onEdit} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="Edit location">
                        <Edit3 className="w-[18px] h-[18px]" />
                    </button>
                    <button onClick={locationActions.onDelete} className="w-11 h-11 rounded-full flex items-center justify-center text-themeredred hover:text-themeredred/80 active:scale-95 transition-all duration-200" aria-label="Delete location">
                        <Trash2 className="w-[18px] h-[18px]" />
                    </button>
                    <button onClick={handleClose} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="Close">
                        <X className="w-[18px] h-[18px]" />
                    </button>
                </div>
            )
        }
        return (
            <div className="flex items-center gap-1.5">
                <button onClick={locationActions.onEdit} className="flex items-center gap-1.5 h-8 px-3 rounded-full border border-tertiary/20 text-xs font-medium text-primary hover:bg-secondary/5 transition-colors">
                    <Edit3 size={16} /> Edit
                </button>
                <button onClick={locationActions.onDelete} className="flex items-center justify-center h-8 w-8 rounded-full border border-themeredred/20 text-themeredred hover:bg-themeredred/10 transition-colors">
                    <Trash2 size={16} />
                </button>
            </div>
        )
    }, [locationActions, isMobile, handleClose])

    const headerConfig = useMemo(() => {
        switch (view) {
            case 'property':
                if (isMobile && mobileLocationView) {
                    // Show location edit/delete in header when drilling into a canvas location
                    return {
                        title: 'Property Book',
                        showBack: true,
                        onBack: () => { selectZone(null); setMobileLocationView(false) },
                        rightContent: locationHeaderActions,
                        hideDefaultClose: !!(isMobile && locationHeaderActions),
                    }
                }
                return { title: 'Property Book', rightContent: mainHeaderActions, hideDefaultClose: !!mainHeaderActions }
            case 'property-detail':
                return { title: selectedPropertyItemName ?? 'Item', showBack: true, onBack: handleBack, rightContent: detailHeaderActions, hideDefaultClose: !!(isMobile && detailHeaderActions) }
            case 'property-transfer':
                return { title: 'Transfer Custody', showBack: true, onBack: handleBack }
            case 'property-form':
                return { title: selectedPropertyItemName ? 'Edit Item' : 'Add Item', showBack: true, onBack: handleBack }
        }
    }, [view, selectedPropertyItemName, handleBack, isMobile, mobileLocationView, detailHeaderActions, mainHeaderActions, locationHeaderActions, selectZone])

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            fullHeight="90dvh"
            desktopPosition="left"
            desktopWidth="w-[90%]"
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
                        onRegisterAddLocation={(fn) => { addLocationTriggerRef.current = fn }}
                        onRegisterLocationActions={setLocationActions}
                    />
                </div>
            </ContentWrapper>
        </BaseDrawer>
    )
}
