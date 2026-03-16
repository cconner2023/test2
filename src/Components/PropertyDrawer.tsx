import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { ArrowRightLeft, Pencil, Trash2, Plus, FolderPlus, Search, X } from 'lucide-react'
import { useSpring, animated } from '@react-spring/web'
import { HeaderPill, PillButton } from './HeaderPill'
import { BaseDrawer } from './BaseDrawer'
import { PropertyPanel, type PropertyView } from './Property/PropertyPanel'
import { ContentWrapper } from './Settings/ContentWrapper'
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
    const { selectZone, setDefaultLocationId, setEditingItem, canvasStack, navigateBack, navigateToPath } = usePropertyStore()
    const [view, setView] = useState<PropertyView>('property')
    const [selectedPropertyItemName, setSelectedPropertyItemName] = useState<string | null>(null)
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')

    const [mobileLocationView, setMobileLocationView] = useState(false)
    const [drilldownPath, setDrilldownPath] = useState<DrilldownSegment[]>([])
    const locationListRef = useRef<PropertyLocationListHandle>(null)

    // Search state — animated overlay in header (same pattern as MessagesDrawer)
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearchExpanded, setIsSearchExpanded] = useState(false)
    const searchInputRef = useRef<HTMLInputElement>(null)

    const searchSpring = useSpring({
        progress: isSearchExpanded ? 1 : 0,
        config: { tension: 260, friction: 26 },
    })

    useEffect(() => {
        if (isSearchExpanded && searchInputRef.current) {
            searchInputRef.current.focus()
        }
    }, [isSearchExpanded])

    const collapseSearch = useCallback(() => {
        setSearchQuery('')
        setIsSearchExpanded(false)
    }, [])

    // Callbacks for detail-view header actions (set by PropertyPanel)
    const [detailActions, setDetailActions] = useState<{
        onEdit: () => void
        onTransfer: () => void
        onDelete: () => void
    } | null>(null)

    // Callbacks for canvas location edit/delete (set by PropertyLocationMap via PropertyPanel)
    const [locationActions, setLocationActions] = useState<LocationEditActions | null>(null)

    const isMobile = useIsMobile()

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
        setDrilldownPath([])
        setSearchQuery('')
        setIsSearchExpanded(false)
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

    const handleNewItem = useCallback(() => {
        setDefaultLocationId(null)
        setEditingItem(null)
        handleAddItem()
    }, [setDefaultLocationId, setEditingItem, handleAddItem])

    const handleNewLocation = useCallback(() => {
        addLocationTriggerRef.current?.()
    }, [])

    const mainHeaderActions = useMemo(() => {
        return (
            <div className="relative flex items-center w-full">
                <animated.div
                    style={{
                        opacity: searchSpring.progress.to(p => 1 - p),
                        pointerEvents: isSearchExpanded ? 'none' : 'auto',
                    }}
                >
                    <HeaderPill>
                        <PillButton icon={Plus} onClick={handleNewItem} label="New item" />
                        <PillButton icon={FolderPlus} onClick={handleNewLocation} label="New location" />
                        <PillButton icon={Search} onClick={() => setIsSearchExpanded(true)} label="Search" />
                        <PillButton icon={X} onClick={handleClose} label="Close" />
                    </HeaderPill>
                </animated.div>

                <animated.div
                    className="absolute inset-0 flex items-center"
                    style={{
                        opacity: searchSpring.progress,
                        transform: searchSpring.progress.to(p => `scale(${0.97 + 0.03 * p})`),
                        pointerEvents: isSearchExpanded ? 'auto' : 'none',
                    }}
                >
                    <div className="flex items-center w-full rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2">
                        <input
                            ref={searchInputRef}
                            type="search"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Escape') collapseSearch() }}
                            className="text-tertiary bg-transparent outline-none text-[16px] w-full px-4 py-2 rounded-l-full min-w-0 [&::-webkit-search-cancel-button]:hidden"
                        />
                        <div
                            className="flex items-center justify-center px-2 py-2 bg-themewhite2 stroke-themeblue3 rounded-r-full cursor-pointer transition-all duration-300 hover:bg-themewhite shrink-0"
                            onClick={collapseSearch}
                        >
                            <X className="w-5 h-5 stroke-themeblue1" />
                        </div>
                    </div>
                </animated.div>
            </div>
        )
    }, [handleNewItem, handleNewLocation, handleClose, isSearchExpanded, searchQuery, searchSpring, collapseSearch])

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
                        rightContentFill: isSearchExpanded,
                    }
                }
                return { title: 'Property Book', rightContent: mainHeaderActions, hideDefaultClose: true, rightContentFill: isSearchExpanded }
            case 'property-detail':
                return { title: selectedPropertyItemName ?? 'Item', showBack: true, onBack: handleBack, rightContent: detailHeaderActions, hideDefaultClose: !!detailHeaderActions }
            case 'property-transfer':
                return { title: 'Transfer Custody', showBack: true, onBack: handleBack }
            case 'property-form':
                return { title: selectedPropertyItemName ? 'Edit Item' : 'Add Item', showBack: true, onBack: handleBack }
        }
    }, [view, selectedPropertyItemName, handleBack, isMobile, mobileLocationView, drilldownPath, detailHeaderActions, mainHeaderActions, locationHeaderActions, canvasStack, navigateBack, isSearchExpanded])

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
                        searchQuery={searchQuery}
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
                        onDrilldownChange={setDrilldownPath}
                        locationListRef={locationListRef}
                    />
                </div>
            </ContentWrapper>
        </BaseDrawer>
    )
}
