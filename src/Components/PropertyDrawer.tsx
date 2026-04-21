import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Pencil, X, Trash2, List, Map as MapIcon, ScanLine, Plus } from 'lucide-react'
import { HeaderPill, PillButton } from './HeaderPill'
import { BaseDrawer } from './BaseDrawer'
import { PropertyPanel, type PropertyView } from './Property/PropertyPanel'
import { PropertyLocationMap, type MapNavHandle } from './Property/PropertyLocationMap'
import { ContentWrapper } from './ContentWrapper'
import { MobileSearchBar } from './MobileSearchBar'
import { ConfirmDialog } from './ConfirmDialog'
import { ItemScanner } from './Property/ItemScanner'
import { PropertyItemForm } from './Property/PropertyItemForm'
import { EnrollScanStep } from './Property/EnrollScanStep'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import { useClinicName } from '../Hooks/useClinicNameResolver'
import type { LocalPropertyItem } from '../Types/PropertyTypes'
import type { PropertyLocationListHandle, DrilldownSegment } from './Property/PropertyLocationList'
import { ActionSheet } from './ActionSheet'
import { UI_TIMING } from '../Utilities/constants'
import { usePropertyStore } from '../stores/usePropertyStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useShallow } from 'zustand/react/shallow'

interface PropertyDrawerProps {
    isVisible: boolean
    onClose: () => void
}

export function PropertyDrawer({ isVisible, onClose }: PropertyDrawerProps) {
    const store = usePropertyStore(
        useShallow((s) => ({
            navigateToPath: s.navigateToPath,
            init: s.init,
            setEditingItem: s.setEditingItem,
            removeItem: s.removeItem,
            items: s.items,
            locations: s.locations,
            clinicId: s.clinicId,
            addLocation: s.addLocation,
            editLocation: s.editLocation,
            removeLocation: s.removeLocation,
            editItem: s.editItem,
            visibleLocations: s.visibleLocations,
            enrollFingerprint: s.enrollFingerprint,
            expendItem: s.expendItem,
        }))
    )
    const { navigateToPath, init, setEditingItem, removeItem, items } = store
    const isSupervisorRole = useAuthStore(s => s.isSupervisorRole)
    const clinicName = useClinicName(store.clinicId) || 'Clinic'

    const [view, setView] = useState<PropertyView>('property')
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')
    const [mapView, setMapView] = useState(false)

    const [drilldownPath, setDrilldownPath] = useState<DrilldownSegment[]>([])
    const locationListRef = useRef<PropertyLocationListHandle>(null)
    const mapRef = useRef<MapNavHandle>(null)

    const [searchQuery, setSearchQuery] = useState('')
    const [searchFocused, setSearchFocused] = useState(false)
    const [selectedItem, setSelectedItem] = useState<LocalPropertyItem | null>(null)
    const [pendingDeleteItem, setPendingDeleteItem] = useState<LocalPropertyItem | null>(null)
    const [scanMode, setScanMode] = useState(false)
    const [enrollingItem, setEnrollingItem] = useState<LocalPropertyItem | null>(null)
    const [showAddSheet, setShowAddSheet] = useState(false)
    const addItemTriggerRef = useRef<(() => void) | null>(null)
    const addLocationTriggerRef = useRef<(() => void) | null>(null)
    const initRef = useRef(false)

    useEffect(() => { setSearchQuery(''); setSearchFocused(false) }, [view])

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
        setMapView(false)
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

    const handleCreateItemFromMap = useCallback(() => {
        setEditingItem(null)
        setView('property-form')
    }, [setEditingItem])

    const handleScanMatch = useCallback(async (itemId: string, qty: number) => {
        await store.expendItem(itemId, qty)
        setScanMode(false)
    }, [store])

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
        setMapView(false)
        setSelectedItem(null)
        setEditingItem(null)
        navigateToPath([])
        onClose()
    }, [onClose, navigateToPath, setEditingItem])

    const handleCreateLocation = useCallback(async (data: Parameters<typeof store.addLocation>[0]) => {
        return store.addLocation(data)
    }, [store])

    const swipeHandlers = useSwipeBack(
        useMemo(() => {
            if (view === 'property') return undefined
            return handleBack
        }, [view, handleBack]),
        view !== 'property',
    )

    const mainHeaderActions = useMemo(() => (
        <HeaderPill>
            <PillButton icon={X} onClick={handleClose} label="Close" />
        </HeaderPill>
    ), [handleClose])

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
                return {
                    title: selectedItem?.name ?? 'Item Detail',
                    showBack: true,
                    onBack: handleBack,
                    rightContent: (
                        <HeaderPill>
                            <PillButton icon={Pencil} iconSize={18} onClick={handleEditItem} label="Edit" />
                            {isSupervisorRole && <PillButton icon={Trash2} iconSize={18} variant="danger" onClick={() => selectedItem && handleDeleteItem(selectedItem)} label="Delete" />}
                        </HeaderPill>
                    ),
                }
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
            scrollDisabled
        >
            <div className="h-full relative">
                {mapView && store.clinicId ? (
                    <div className="h-full flex">
                        <div className="flex-1 min-w-0">
                            <PropertyLocationMap
                                ref={mapRef}
                                clinicId={store.clinicId}
                                clinicName={clinicName}
                                locations={store.visibleLocations()}
                                items={items}
                                onCreateLocation={handleCreateLocation}
                                onDeleteLocation={store.removeLocation}
                                onEditItem={(id, updates) => store.editItem(id, updates)}
                                onUpdateLocation={(id, updates) => store.editLocation(id, updates)}
                                onSelectItem={handleSelectItem}
                                onCreateItem={handleCreateItemFromMap}
                            />
                        </div>
                        {isMobile && view === 'property-form' && (
                            <div className="absolute inset-0 z-40 bg-themewhite overflow-y-auto">
                                <PropertyItemForm editingItem={null} onClose={() => setView('property')} />
                            </div>
                        )}
                        {!isMobile && (
                            <div className={`shrink-0 border-l border-primary/10 flex flex-col bg-themewhite overflow-y-auto transition-all duration-300 ${
                                view === 'property-form' ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'
                            }`}>
                                {view === 'property-form' && (
                                    <PropertyItemForm editingItem={null} onClose={() => setView('property')} />
                                )}
                            </div>
                        )}
                    </div>
                ) : (
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
                                        selectedItem={selectedItem}
                                        onSelectItem={handleSelectItem}
                                        onEditItem={handleEditItem}
                                        onDeleteItem={isSupervisorRole ? handleDeleteItem : undefined}
                                        onAddItem={handleAddItem}
                                        onBack={handleBack}
                                        onDrilldownChange={setDrilldownPath}
                                        locationListRef={locationListRef}
                                        onEnrollItem={(item) => setEnrollingItem(item)}
                                        onRegisterAddItem={(t) => { addItemTriggerRef.current = t }}
                                        onRegisterAddLocation={(t) => { addLocationTriggerRef.current = t }}
                                    />
                                </div>
                            </MobileSearchBar>
                        ) : (
                            <div className="h-full relative">
                                <PropertyPanel
                                    isMobile={false}
                                    view={view}
                                    searchQuery={searchQuery}
                                    selectedItem={selectedItem}
                                    onSearchChange={setSearchQuery}
                                    onSelectItem={handleSelectItem}
                                    onEditItem={handleEditItem}
                                    onDeleteItem={handleDeleteItem}
                                    onAddItem={handleAddItem}
                                    onBack={handleBack}
                                    onEnrollItem={(item) => setEnrollingItem(item)}
                                    onRegisterAddItem={(t) => { addItemTriggerRef.current = t }}
                                    onRegisterAddLocation={(t) => { addLocationTriggerRef.current = t }}
                                />
                            </div>
                        )}
                    </ContentWrapper>
                )}

                {(view === 'property' || mapView) && (
                    <div className="absolute bottom-4 inset-x-0 flex items-center justify-center z-30 pointer-events-none pb-[max(0rem,var(--sab,0px))]">
                        <div data-tour="property-view-toggle" className="flex items-center gap-1.5 rounded-full bg-themewhite border border-tertiary/20 px-0.5 py-0.5 shadow-lg pointer-events-auto">
                            <button
                                onClick={() => { setMapView(false) }}
                                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${!mapView ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                            >
                                <List className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setScanMode(true)}
                                className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 text-tertiary hover:text-primary"
                            >
                                <ScanLine className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => { setMapView(true) }}
                                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${mapView ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                            >
                                <MapIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {view === 'property' && !mapView && (
                    <div className="absolute bottom-4 right-4 z-30 rounded-full border border-tertiary/20 p-0.5 bg-themewhite shadow-lg pb-[max(0.25rem,calc(var(--sab,0px)+0.25rem))]">
                        <button
                            data-tour="property-add-fab"
                            onClick={() => setShowAddSheet(true)}
                            className="w-11 h-11 rounded-full bg-themeblue3 text-white flex items-center justify-center active:scale-95 transition-all duration-200"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>

            <ActionSheet
                visible={showAddSheet}
                title="Add to Property Book"
                options={[
                    { key: 'item', label: 'New Item', onAction: () => { setShowAddSheet(false); addItemTriggerRef.current?.() } },
                    { key: 'location', label: 'New Location', onAction: () => { setShowAddSheet(false); addLocationTriggerRef.current?.() } },
                ]}
                onClose={() => setShowAddSheet(false)}
            />

            <ConfirmDialog
                visible={!!pendingDeleteItem}
                title="Delete this item? This cannot be undone."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => setPendingDeleteItem(null)}
            />

            {scanMode && (
                <ItemScanner
                    items={items}
                    onMatch={handleScanMatch}
                    onClose={() => setScanMode(false)}
                />
            )}

            {enrollingItem && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center pb-8">
                    <div className="w-full max-w-md bg-themewhite rounded-3xl p-6 mx-4">
                        <EnrollScanStep
                            itemId={enrollingItem.id}
                            itemName={enrollingItem.name}
                            onEnrolled={async (fp) => {
                                await store.enrollFingerprint(enrollingItem.id, fp)
                                setEnrollingItem(null)
                            }}
                            onSkip={() => setEnrollingItem(null)}
                        />
                    </div>
                </div>
            )}
        </BaseDrawer>
    )
}
