import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Pencil, X } from 'lucide-react'
import { HeaderPill, PillButton } from './HeaderPill'
import { BaseDrawer } from './BaseDrawer'
import { PropertyPanel, type PropertyView } from './Property/PropertyPanel'
import { ContentWrapper } from './Settings/ContentWrapper'
import { MobileSearchBar } from './MobileSearchBar'
import { ConfirmDialog } from './ConfirmDialog'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import type { LocalPropertyItem } from '../Types/PropertyTypes'
import type { PropertyLocationListHandle, DrilldownSegment } from './Property/PropertyLocationList'
import { UI_TIMING } from '../Utilities/constants'
import { usePropertyStore } from '../stores/usePropertyStore'

interface PropertyDrawerProps {
    isVisible: boolean
    onClose: () => void
}

export function PropertyDrawer({ isVisible, onClose }: PropertyDrawerProps) {
    const { navigateToPath, init, setEditingItem, removeItem, items } = usePropertyStore()
    const [view, setView] = useState<PropertyView>('property')
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')

    const [drilldownPath, setDrilldownPath] = useState<DrilldownSegment[]>([])
    const locationListRef = useRef<PropertyLocationListHandle>(null)

    const [searchQuery, setSearchQuery] = useState('')
    const [searchFocused, setSearchFocused] = useState(false)
    const [editing, setEditing] = useState(false)
    const [selectedItem, setSelectedItem] = useState<LocalPropertyItem | null>(null)
    const [pendingDeleteItem, setPendingDeleteItem] = useState<LocalPropertyItem | null>(null)
    const initRef = useRef(false)

    useEffect(() => { setSearchQuery(''); setSearchFocused(false); setEditing(false) }, [view])

    // Keep selectedItem fresh when store items update (e.g. after edit)
    useEffect(() => {
        if (selectedItem) {
            const fresh = items.find(i => i.id === selectedItem.id)
            if (fresh && fresh !== selectedItem) setSelectedItem(fresh)
            else if (!fresh) { setSelectedItem(null); setView('property') }
        }
    }, [items, selectedItem])

    // Init store on first open
    useEffect(() => {
        if (isVisible && !initRef.current) {
            initRef.current = true
            init()
        }
    }, [isVisible, init])

    const isMobile = useIsMobile()

    const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
        setSlideDirection(direction)
        setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION)
    }, [])

    const handleSelectItem = useCallback((item: LocalPropertyItem) => {
        setSelectedItem(item)
        handleSlideAnimation('left')
        setView('property-detail')
    }, [handleSlideAnimation])

    const handleEditItem = useCallback(() => {
        if (selectedItem) {
            setEditingItem(selectedItem)
            if (isMobile) {
                handleSlideAnimation('right')
                setSelectedItem(null)
                setView('property')
            } else {
                handleSlideAnimation('left')
                setView('property-form')
            }
        }
    }, [selectedItem, setEditingItem, handleSlideAnimation, isMobile])

    const handleDeleteItem = useCallback((item: LocalPropertyItem) => {
        setPendingDeleteItem(item)
    }, [])

    const handleConfirmDelete = useCallback(async () => {
        if (!pendingDeleteItem) return
        await removeItem(pendingDeleteItem.id)
        setPendingDeleteItem(null)
        setSelectedItem(null)
        if (view === 'property-detail') {
            handleSlideAnimation('right')
            setView('property')
        }
    }, [pendingDeleteItem, removeItem, view, handleSlideAnimation])

    const handleAddItem = useCallback(() => {
        if (!isMobile) {
            handleSlideAnimation('left')
            setView('property-form')
        }
    }, [handleSlideAnimation, isMobile])

    const handleBack = useCallback(() => {
        if (view === 'property-form') {
            handleSlideAnimation('right')
            // If we came from detail, go back to detail; otherwise go to list
            if (selectedItem) {
                setEditingItem(null)
                setView('property-detail')
            } else {
                setEditingItem(null)
                setView('property')
            }
        } else if (view === 'property-detail') {
            handleSlideAnimation('right')
            setSelectedItem(null)
            setView('property')
        }
    }, [view, selectedItem, handleSlideAnimation, setEditingItem])

    const handleClose = useCallback(() => {
        setView('property')
        setSlideDirection('')
        setDrilldownPath([])
        setSearchQuery('')
        setEditing(false)
        setSelectedItem(null)
        setEditingItem(null)
        navigateToPath([])
        onClose()
    }, [onClose, navigateToPath, setEditingItem])

    const swipeHandlers = useSwipeBack(
        useMemo(() => {
            if (view === 'property') return undefined
            return handleBack
        }, [view, handleBack]),
        view !== 'property',
    )

    const mainHeaderActions = useMemo(() => (
        <HeaderPill>
            <PillButton
              icon={Pencil}
              onClick={() => setEditing((e) => !e)}
              label={editing ? 'Done' : 'Edit'}
              circleBg={editing ? 'bg-themeblue2/15 text-themeblue2' : undefined}
            />
            <PillButton icon={X} onClick={handleClose} label="Close" />
        </HeaderPill>
    ), [handleClose, editing])

    const headerConfig = useMemo(() => {
        switch (view) {
            case 'property':
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
                if (!isMobile) return { title: 'Property Book', badge: 'BETA', rightContent: mainHeaderActions, hideDefaultClose: true }
                return { title: selectedItem?.name ?? 'Item Detail', showBack: true, onBack: handleBack }
            case 'property-form':
                if (!isMobile) return { title: 'Property Book', badge: 'BETA', rightContent: mainHeaderActions, hideDefaultClose: true }
                return { title: selectedItem ? 'Edit Item' : 'Add Item', showBack: true, onBack: handleBack }
        }
    }, [view, handleBack, isMobile, drilldownPath, mainHeaderActions, selectedItem])

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
                                editing={editing}
                                selectedItem={selectedItem}
                                onSelectItem={handleSelectItem}
                                onEditItem={handleEditItem}
                                onDeleteItem={handleDeleteItem}
                                onAddItem={handleAddItem}
                                onBack={handleBack}
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
                            editing={editing}
                            selectedItem={selectedItem}
                            onSearchChange={setSearchQuery}
                            onSelectItem={handleSelectItem}
                            onEditItem={handleEditItem}
                            onDeleteItem={handleDeleteItem}
                            onAddItem={handleAddItem}
                            onBack={handleBack}
                        />
                    </div>
                )}
            </ContentWrapper>

            <ConfirmDialog
                visible={!!pendingDeleteItem}
                title="Delete this item? This cannot be undone."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => setPendingDeleteItem(null)}
            />
        </BaseDrawer>
    )
}
