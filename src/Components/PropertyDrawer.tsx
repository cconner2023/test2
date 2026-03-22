import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { ArrowRightLeft, Pencil, Trash2, X } from 'lucide-react'
import { HeaderPill, PillButton } from './HeaderPill'
import { BaseDrawer } from './BaseDrawer'
import { PropertyPanel, type PropertyView } from './Property/PropertyPanel'
import { ContentWrapper } from './Settings/ContentWrapper'
import { MobileSearchBar } from './MobileSearchBar'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import type { LocalPropertyItem } from '../Types/PropertyTypes'
import type { LocationEditActions } from './Property/PropertyPanel'
import type { PropertyLocationListHandle, DrilldownSegment } from './Property/PropertyLocationList'
import { UI_TIMING } from '../Utilities/constants'
import { usePropertyStore } from '../stores/usePropertyStore'

interface PropertyDrawerProps {
    isVisible: boolean
    onClose: () => void
}

export function PropertyDrawer({ isVisible, onClose }: PropertyDrawerProps) {
    const { canvasStack, navigateBack, navigateToPath } = usePropertyStore()
    const [view, setView] = useState<PropertyView>('property')
    const [selectedPropertyItemName, setSelectedPropertyItemName] = useState<string | null>(null)
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')

    const [mobileLocationView, setMobileLocationView] = useState(false)
    const [drilldownPath, setDrilldownPath] = useState<DrilldownSegment[]>([])
    const locationListRef = useRef<PropertyLocationListHandle>(null)

    const [searchQuery, setSearchQuery] = useState('')
    const [searchFocused, setSearchFocused] = useState(false)

    // Clear search when navigating between views (e.g., clicking a search result)
    useEffect(() => { setSearchQuery(''); setSearchFocused(false) }, [view])

    // Callbacks for detail-view header actions (set by PropertyPanel)
    const [detailActions, setDetailActions] = useState<{
        onEdit: () => void
        onTransfer: () => void
        onDelete: () => void
    } | null>(null)

    // Callbacks for canvas location edit/delete (set by PropertyLocationMap via PropertyPanel)
    const [locationActions, setLocationActions] = useState<LocationEditActions | null>(null)

    const isMobile = useIsMobile()


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
        setDrilldownPath([])
        setSearchQuery('')
        navigateToPath([])
        onClose()
    }, [onClose, navigateToPath])

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
        return (
            <HeaderPill>
                <PillButton icon={ArrowRightLeft} onClick={onTransfer} label="Transfer" />
                <PillButton icon={Pencil} onClick={onEdit} label="Edit" />
                <PillButton icon={Trash2} onClick={onDelete} label="Delete" variant="danger" />
                <PillButton icon={X} onClick={handleClose} label="Close" />
            </HeaderPill>
        )
    }, [detailActions, handleClose])


    const mainHeaderActions = useMemo(() => (
        <HeaderPill>
            <PillButton icon={X} onClick={handleClose} label="Close" />
        </HeaderPill>
    ), [handleClose])

    const locationHeaderActions = useMemo(() => {
        if (!locationActions) return undefined
        return (
            <HeaderPill>
                <PillButton icon={Pencil} onClick={locationActions.onEdit} label="Edit location" />
                <PillButton icon={Trash2} onClick={locationActions.onDelete} label="Delete location" variant="danger" />
                <PillButton icon={X} onClick={handleClose} label="Close" />
            </HeaderPill>
        )
    }, [locationActions, handleClose])

    const headerConfig = useMemo(() => {
        switch (view) {
            case 'property':
                if (isMobile && mobileLocationView) {
                    return {
                        title: 'Property Book',
                        showBack: true,
                        onBack: () => {
                            if (canvasStack.length > 0) {
                                navigateBack()
                            } else {
                                setMobileLocationView(false)
                            }
                        },
                        rightContent: locationHeaderActions,
                        hideDefaultClose: !!locationHeaderActions,
                    }
                }
                if (isMobile && drilldownPath.length > 0) {
                    const currentName = drilldownPath[drilldownPath.length - 1].name
                    return {
                        title: currentName,
                        showBack: true,
                        onBack: () => locationListRef.current?.popPath(),
                        rightContent: mainHeaderActions,
                        hideDefaultClose: true,
                    }
                }
                return { title: 'Property Book', badge: 'BETA', rightContent: mainHeaderActions, hideDefaultClose: true }
            case 'property-detail':
                return { title: selectedPropertyItemName ?? 'Item', showBack: true, onBack: handleBack, rightContent: detailHeaderActions, hideDefaultClose: !!detailHeaderActions }
            case 'property-transfer':
                return { title: 'Transfer Custody', showBack: true, onBack: handleBack }
            case 'property-form':
                return { title: selectedPropertyItemName ? 'Edit Item' : 'Add Item', showBack: true, onBack: handleBack }
        }
    }, [view, selectedPropertyItemName, handleBack, isMobile, mobileLocationView, drilldownPath, detailHeaderActions, mainHeaderActions, locationHeaderActions, canvasStack, navigateBack])

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            fullHeight="90dvh"
            desktopPosition="left"
            desktopWidth="w-[90%]"
            header={headerConfig}
            headerFaded={searchFocused}
        >
            <ContentWrapper slideDirection={isMobile ? slideDirection : ''} swipeHandlers={isMobile && view !== 'property' ? swipeHandlers : undefined}>
                {isMobile ? (
                    <MobileSearchBar variant="property"
                        value={searchQuery}
                        onChange={setSearchQuery}
                        enabled={view === 'property'}
                        onFocusChange={setSearchFocused}
                    >
                        <div className="h-full relative">
                            <PropertyPanel
                                isMobile={isMobile}
                                view={view}
                                searchQuery={searchQuery}
                                onSelectItem={handleSelectItem}
                                onAddItem={handleAddItem}
                                onEditItem={handleEditItem}
                                onTransferItem={handleTransfer}
                                onBack={handleBack}
                                mobileLocationView={mobileLocationView}
                                onMobileLocationViewChange={setMobileLocationView}
                                onRegisterDetailActions={setDetailActions}
                                onRegisterLocationActions={setLocationActions}
                                onDrilldownChange={setDrilldownPath}
                                locationListRef={locationListRef}
                            />
                        </div>
                    </MobileSearchBar>
                ) : (
                    <div className="h-full relative">
                        <PropertyPanel
                            isMobile={false}
                            view={view}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onSelectItem={handleSelectItem}
                            onAddItem={handleAddItem}
                            onEditItem={handleEditItem}
                            onTransferItem={handleTransfer}
                            onBack={handleBack}
                            onRegisterDetailActions={setDetailActions}
                            onRegisterLocationActions={setLocationActions}
                        />
                    </div>
                )}
            </ContentWrapper>
        </BaseDrawer>
    )
}
