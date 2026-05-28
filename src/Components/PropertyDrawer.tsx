import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Pencil, X, Trash2, List, Map as MapIcon, ScanLine } from 'lucide-react'
import { HeaderPill, PillButton } from './HeaderPill'
import { BaseDrawer } from './BaseDrawer'
import { BottomIsland, IslandButton } from './BottomIsland'
import { AddFab } from './AddFab'
import { PropertyPanel, type PropertyView } from './Property/PropertyPanel'
import { PropertyLocationMap, type MapNavHandle } from './Property/PropertyLocationMap'
import { ContentWrapper } from './ContentWrapper'
import { SearchInput } from './SearchInput'
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
import { useNavigationStore } from '../stores/useNavigationStore'
import { useShallow } from 'zustand/react/shallow'
import { exportPropertyCSV } from '../Utilities/PropertyCSV'
import { PropertyCSVImportSheet } from './Property/PropertyCSVImportSheet'

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
    const clinicName = useClinicName(store.clinicId) || 'Cluster'

    const [view, setView] = useState<PropertyView>('property')
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')
    const [mapView, setMapView] = useState(false)

    const [drilldownPath, setDrilldownPath] = useState<DrilldownSegment[]>([])
    const locationListRef = useRef<PropertyLocationListHandle>(null)
    const mapRef = useRef<MapNavHandle>(null)

    const [searchQuery, setSearchQuery] = useState('')
    const [selectedItem, setSelectedItem] = useState<LocalPropertyItem | null>(null)
    const [pendingDeleteItem, setPendingDeleteItem] = useState<LocalPropertyItem | null>(null)
    const [scanMode, setScanMode] = useState(false)
    const [enrollingItem, setEnrollingItem] = useState<LocalPropertyItem | null>(null)
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [showImportSheet, setShowImportSheet] = useState(false)
    const addItemTriggerRef = useRef<(() => void) | null>(null)
    const addLocationTriggerRef = useRef<(() => void) | null>(null)
    const initRef = useRef(false)

    useEffect(() => { setSearchQuery('') }, [view])

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

    // Deep-link: open straight to an item when navigated here with a focus id
    // (e.g. tapping a shared property card in a chat). Waits for items to load.
    const propertyDrawerItemId = useNavigationStore(s => s.propertyDrawerItemId)
    const clearPropertyDrawerItemId = useNavigationStore(s => s.clearPropertyDrawerItemId)
    useEffect(() => {
        if (!isVisible || !propertyDrawerItemId) return
        const item = items.find(i => i.id === propertyDrawerItemId)
        if (item) {
            setSelectedItem(item)
            setView('property-detail')
            clearPropertyDrawerItemId()
        }
    }, [isVisible, propertyDrawerItemId, items, clearPropertyDrawerItemId])

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
                return { title: 'Property Book', rightContent: mainHeaderActions, hideDefaultClose: true }
            case 'property-detail':
                if (!isMobile) return { title: 'Property Book', rightContent: mainHeaderActions, hideDefaultClose: true }
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
                if (!isMobile) return { title: 'Property Book', rightContent: mainHeaderActions, hideDefaultClose: true }
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
            glassHeader={isMobile && view === 'property' && !mapView}
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
                            <div className="h-full">
                                <PropertyPanel
                                    isMobile={isMobile}
                                    view={view}
                                    searchQuery={searchQuery}
                                    onSearchChange={setSearchQuery}
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
                    <BottomIsland z="z-30" tour="property-view-toggle">
                        <IslandButton active={!mapView} onClick={() => setMapView(false)} label="List">
                            <List className="w-5 h-5" />
                        </IslandButton>
                        <IslandButton onClick={() => setScanMode(true)} label="Scan">
                            <ScanLine className="w-5 h-5" />
                        </IslandButton>
                        <IslandButton active={mapView} onClick={() => setMapView(true)} label="Map">
                            <MapIcon className="w-5 h-5" />
                        </IslandButton>
                    </BottomIsland>
                )}

                {view === 'property' && !mapView && (
                    <AddFab
                        tour="property-add-fab"
                        label="Add"
                        onClick={() => setShowAddSheet(true)}
                        className="absolute bottom-4 right-4 z-30 pb-[max(0.25rem,calc(var(--sab,0px)+0.25rem))]"
                    />
                )}
            </div>

            <ActionSheet
                visible={showAddSheet}
                title="Add to Property Book"
                options={[
                    { key: 'item', label: 'New Item', onAction: () => { setShowAddSheet(false); addItemTriggerRef.current?.() } },
                    { key: 'location', label: 'New Location', onAction: () => { setShowAddSheet(false); addLocationTriggerRef.current?.() } },
                    { key: 'import-csv', label: 'Import CSV', onAction: () => { setShowAddSheet(false); setShowImportSheet(true) } },
                    { key: 'export-csv', label: 'Export CSV', onAction: () => { setShowAddSheet(false); exportPropertyCSV(items, store.locations) } },
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
            <PropertyCSVImportSheet
                visible={showImportSheet}
                onClose={() => setShowImportSheet(false)}
            />
        </BaseDrawer>
    )
}
