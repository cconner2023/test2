/**
 * USER-GUIDE ICON REGISTRY — the only place the guide names a Lucide icon.
 *
 * The guide data (src/Data/UserGuide.ts) is intentionally string-only (same as
 * image `src`), so it must NOT import icon components. Instead an inline button
 * segment names an icon by KEY here, and UserGuideBody resolves the component.
 * That keeps the data module free of `lucide-react` at runtime — UserGuide.ts
 * imports only the `GuideIconName` *type* (erased at build).
 *
 * Keys are kebab-case and should read like the button they mimic ('plus',
 * 'trash-2', 'more-horizontal'). To add a button to the registry: import its
 * Lucide component and add a line — authors then get autocomplete + a compile
 * error on any typo, because GuideIconName is `keyof typeof GuideIconRegistry`.
 *
 * The set below mirrors the action icons actually mounted on buttons across the
 * app (Check/Plus/Trash2/… lead by usage). Extend as the guide references more.
 */
import {
    Plus, Check, X, Trash2, Pencil, MoreHorizontal, Download, Upload,
    ChevronLeft, ChevronRight, ChevronDown, Search, Filter, Save, Send,
    Camera, ScanLine, Printer, RefreshCw, RotateCcw, Undo2, History, Share2,
    Settings, Bell, User, Users, Calendar, MessageSquare, MapPin, Navigation,
    Route, Info, List, Package, Play, Pin, SlidersHorizontal, Mic, type LucideIcon,
} from 'lucide-react';

export const GuideIconRegistry = {
    plus: Plus,
    check: Check,
    x: X,
    'trash-2': Trash2,
    pencil: Pencil,
    'more-horizontal': MoreHorizontal,
    download: Download,
    upload: Upload,
    'chevron-left': ChevronLeft,
    'chevron-right': ChevronRight,
    'chevron-down': ChevronDown,
    search: Search,
    filter: Filter,
    save: Save,
    send: Send,
    camera: Camera,
    'scan-line': ScanLine,
    printer: Printer,
    'refresh-cw': RefreshCw,
    'rotate-ccw': RotateCcw,
    'undo-2': Undo2,
    history: History,
    'share-2': Share2,
    settings: Settings,
    bell: Bell,
    user: User,
    users: Users,
    calendar: Calendar,
    'message-square': MessageSquare,
    'map-pin': MapPin,
    navigation: Navigation,
    route: Route,
    info: Info,
    list: List,
    package: Package,
    play: Play,
    pin: Pin,
    sliders: SlidersHorizontal,
    mic: Mic,
} satisfies Record<string, LucideIcon>;

/** Every valid icon key the guide can name. Author-time autocomplete + typo-proofing. */
export type GuideIconName = keyof typeof GuideIconRegistry;
