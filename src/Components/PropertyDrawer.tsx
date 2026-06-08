import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Pencil, X, Trash2, List } from 'lucide-react'
import { HeaderPill, PillButton } from './HeaderPill'
import { BaseDrawer } from './BaseDrawer'
import { PropertyPanel, type PropertyView } from './Property/PropertyPanel'
import { ConfirmDialog } from './ConfirmDialog'
import { ItemScanner } from './Property/ItemScanner'
import { PropertyNavSheet, type PropertyNavSheetHandle } from './Property/PropertyNavSheet'
import { EnrollScanStep } from './Property/EnrollScanStep'
import { useIsMobile } from '../Hooks/useIsMobile'
import type { LocalPropertyItem } from '../Types/PropertyTypes'
import type { PropertyLocationListHandle } from './Property/PropertyLocationList'
import { ActionSheet } from './ActionSheet'
import { usePropertyStore } from '../stores/usePropertyStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useNavigationStore } from '../stores/useNavigationStore'
import { useShallow } from 'zustand/react/shallow'
import { exportPropertyCSV } from '../Utilities/PropertyCSV'
import { PropertyCSVImportDrawer } from './Property/PropertyCSVImportDrawer'

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
            enrollFingerprint: s.enrollFingerprint,
            expendItem: s.expendItem,
        }))
    )
    const { navigateToPath, init, setEditingItem, removeItem, items } = store
    const isSupervisorRole = useAuthStore(s => s.isSupervisorRole)
    const isMobile = useIsMobile()

    const [view, setView] = useState<PropertyView>('property')
    const [showLocationSheet, setShowLocationSheet] = useState(false)

    const locationListRef = useRef<PropertyLocationListHandle>(null)
    const navSheetRef = useRef<PropertyNavSheetHandle>(null)

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
            // Mobile surfaces the item in the shared nav sheet; desktop uses the
            // right detail pane via the view machine.
            if (isMobile) {
                navSheetRef.current?.openItem(item)
            } else {
                setSelectedItem(item)
                setView('property-detail')
            }
            clearPropertyDrawerItemId()
        }
    }, [isVisible, propertyDrawerItemId, items, clearPropertyDrawerItemId, isMobile])

    const handleSelectItem = useCallback((item: LocalPropertyItem) => {
        setSelectedItem(item)
        setView('property-detail')
    }, [])

    const handleEditItem = useCallback(() => {
        if (selectedItem) {
            setEditingItem(selectedItem)
            if (isMobile) {
                setSelectedItem(null)
                setView('property')
            } else {
                setView('property-form')
            }
        }
    }, [selectedItem, setEditingItem, isMobile])

    const handleDeleteItem = useCallback((item: LocalPropertyItem) => {
        setPendingDeleteItem(item)
    }, [])

    const handleConfirmDelete = useCallback(async () => {
        if (!pendingDeleteItem) return
        await removeItem(pendingDeleteItem.id)
        setPendingDeleteItem(null)
        setSelectedItem(null)
        if (view === 'property-detail') {
            setView('property')
        }
    }, [pendingDeleteItem, removeItem, view])

    const handleAddItem = useCallback(() => {
        if (!isMobile) {
            setView('property-form')
        }
    }, [isMobile])

    const handleScanMatch = useCallback(async (itemId: string, qty: number) => {
        await store.expendItem(itemId, qty)
        setScanMode(false)
    }, [store])

    const handleBack = useCallback(() => {
        if (view === 'property-form') {
            // If we came from detail, go back to detail; otherwise go to list
            if (selectedItem) {
                setEditingItem(null)
                setView('property-detail')
            } else {
                setEditingItem(null)
                setView('property')
            }
        } else if (view === 'property-detail') {
            setSelectedItem(null)
            setView('property')
        }
    }, [view, selectedItem, setEditingItem])

    const handleClose = useCallback(() => {
        setView('property')
        setSearchQuery('')
        setShowLocationSheet(false)
        setSelectedItem(null)
        setEditingItem(null)
        navigateToPath([])
        onClose()
    }, [onClose, navigateToPath, setEditingItem])

    const mainHeaderActions = useMemo(() => (
        <HeaderPill>
            <PillButton icon={X} onClick={handleClose} label="Close" />
        </HeaderPill>
    ), [handleClose])

    const headerConfig = useMemo(() => {
        switch (view) {
            case 'property':
                if (!isMobile) return { title: 'Property Book', rightContent: mainHeaderActions, hideDefaultClose: true }
                return {
                    title: 'Property Book',
                    leftContent: (
                        <HeaderPill>
                            <PillButton icon={List} onClick={() => setShowLocationSheet(s => !s)} label="Locations" />
                        </HeaderPill>
                    ),
                    rightContent: mainHeaderActions,
                    hideDefaultClose: true,
                }
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
    }, [view, handleBack, isMobile, mainHeaderActions, selectedItem, handleEditItem, handleDeleteItem, isSupervisorRole])

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            mobileFullScreen
            fullHeight="95dvh"
            desktopPosition="left"
            desktopWidth="w-[90%]"
            header={headerConfig}
            scrollDisabled
        >
            <div className="h-full relative">
                {isMobile ? (
                    <PropertyPanel
                        isMobile
                        view={view}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        selectedItem={selectedItem}
                        showLocationSheet={showLocationSheet}
                        onCloseLocationSheet={() => setShowLocationSheet(false)}
                        onSelectItem={(item) => navSheetRef.current?.openItem(item)}
                        onOpenAddSheet={() => setShowAddSheet(true)}
                        onEditItem={handleEditItem}
                        onDeleteItem={isSupervisorRole ? handleDeleteItem : undefined}
                        onAddItem={handleAddItem}
                        onBack={handleBack}
                        locationListRef={locationListRef}
                        onEnrollItem={(item) => setEnrollingItem(item)}
                        onRegisterAddItem={(t) => { addItemTriggerRef.current = t }}
                        onRegisterAddLocation={(t) => { addLocationTriggerRef.current = t }}
                    />
                ) : (
                    <PropertyPanel
                        isMobile={false}
                        view={view}
                        searchQuery={searchQuery}
                        selectedItem={selectedItem}
                        onSearchChange={setSearchQuery}
                        onSelectItem={handleSelectItem}
                        onOpenAddSheet={() => setShowAddSheet(true)}
                        onEditItem={handleEditItem}
                        onDeleteItem={handleDeleteItem}
                        onAddItem={handleAddItem}
                        onBack={handleBack}
                        onEnrollItem={(item) => setEnrollingItem(item)}
                        onRegisterAddItem={(t) => { addItemTriggerRef.current = t }}
                        onRegisterAddLocation={(t) => { addLocationTriggerRef.current = t }}
                    />
                )}

                {/* Shared mobile nav sheet — location browse / item detail / form,
                    fed by both the map canvas and the location-select sheet. */}
                {isMobile && (
                    <PropertyNavSheet
                        ref={navSheetRef}
                        canDelete={isSupervisorRole}
                        onEnrollItem={(item) => setEnrollingItem(item)}
                    />
                )}
            </div>

            <ActionSheet
                visible={showAddSheet}
                title="Add to Property Book"
                options={[
                    { key: 'item', label: 'New Item', onAction: () => { setShowAddSheet(false); addItemTriggerRef.current?.() } },
                    { key: 'location', label: 'New Location', onAction: () => { setShowAddSheet(false); addLocationTriggerRef.current?.() } },
                    { key: 'scan', label: 'Scan to expend', onAction: () => { setShowAddSheet(false); setScanMode(true) } },
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
            <PropertyCSVImportDrawer
                visible={showImportSheet}
                onClose={() => setShowImportSheet(false)}
            />
        </BaseDrawer>
    )
}
