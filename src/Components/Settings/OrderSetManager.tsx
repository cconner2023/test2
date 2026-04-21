import { Check, X } from 'lucide-react';
import { useState } from 'react';
import type { PlanOrderSet, PlanBlockKey } from '../../Data/User';
import { PLAN_ORDER_CATEGORIES } from '../../Data/User';
import type { ComposingSet } from './PlanPanel';

const ALL_PLAN_BLOCK_KEYS: PlanBlockKey[] = [...PLAN_ORDER_CATEGORIES, 'instructions'];

interface OrderSetManagerProps {
    orderSets: PlanOrderSet[];
    editing?: boolean;
    composing: ComposingSet | null;
    onComposingNameChange: (name: string) => void;
    onStartAdd: (name: string) => void;
    onStartEdit: (os: PlanOrderSet) => void;
    stagedDeletes: Set<string>;
    stagedAdds: PlanOrderSet[];
    stagedEdits: PlanOrderSet[];
    onUnstageAdd: (id: string) => void;
    onUnstageDelete: (id: string) => void;
    clinicOrderSetIds?: Set<string>;
    isSupervisorRole?: boolean;
    scope?: 'personal' | 'clinic';
    onScopeChange?: (scope: 'personal' | 'clinic') => void;
}

export const OrderSetManager = ({
    orderSets, editing = true,
    composing, onComposingNameChange, onStartAdd, onStartEdit,
    stagedDeletes, stagedAdds, stagedEdits, onUnstageAdd, onUnstageDelete,
    clinicOrderSetIds, isSupervisorRole, scope, onScopeChange,
}: OrderSetManagerProps) => {
    const [inputName, setInputName] = useState('');

    const handleSubmitNew = () => {
        if (!inputName.trim()) return;
        onStartAdd(inputName.trim());
        setInputName('');
    };

    const collectTags = (os: PlanOrderSet): string[] =>
        ALL_PLAN_BLOCK_KEYS.flatMap(k => os.presets[k] ?? []);

    // Get display version of an order set (staged edit overrides original)
    const getDisplaySet = (os: PlanOrderSet): PlanOrderSet => {
        const staged = stagedEdits.find(s => s.id === os.id);
        return staged ?? os;
    };

    return (
        <section data-tour="plan-orderset-section">
            <div className="pb-2 flex items-center gap-2">
                <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Order Sets</p>
                <span className="text-[9pt] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium">
                    {orderSets.length + stagedAdds.length - stagedDeletes.size}
                </span>
            </div>

            <div className={`rounded-xl bg-themewhite2 overflow-hidden transition-colors ${
                composing ? 'ring-2 ring-themeblue2/20' : ''
            }`}>
                <div className="px-4 py-3">
                    {/* Add input — edit-gated, hidden when composing */}
                    <div className={`overflow-hidden transition-all duration-300 ease-out ${
                        editing && !composing ? 'max-h-16 opacity-100 mb-2' : 'max-h-0 opacity-0'
                    }`}>
                        <div className="flex items-center gap-1.5">
                            {isSupervisorRole && (
                                <button
                                    type="button"
                                    onClick={() => onScopeChange?.(scope === 'personal' ? 'clinic' : 'personal')}
                                    className={`shrink-0 px-2.5 py-2.5 rounded-full text-[9pt] font-semibold tracking-wide transition-all active:scale-95 ${
                                        scope === 'clinic'
                                            ? 'bg-tertiary/10 text-tertiary border border-tertiary/20'
                                            : 'bg-themeblue2/10 text-themeblue2/70 border border-themeblue2/15'
                                    }`}
                                >
                                    {scope === 'clinic' ? 'Clinic' : 'Personal'}
                                </button>
                            )}
                            <div className="relative flex flex-1 items-center rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                                <input
                                    type="text"
                                    value={inputName}
                                    onChange={(e) => setInputName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmitNew(); } }}
                                    placeholder="New order set name..."
                                    className="w-full bg-transparent outline-none text-sm text-primary px-3.5 py-2.5 rounded-full min-w-0 placeholder:text-tertiary"
                                />
                            </div>
                            {inputName.trim() && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setInputName('')}
                                        className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSubmitNew}
                                        className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
                                    >
                                        <Check size={18} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Compose state — name input */}
                    <div className={`overflow-hidden transition-all duration-300 ease-out ${
                        composing ? 'max-h-16 opacity-100 mb-2' : 'max-h-0 opacity-0'
                    }`}>
                        <div className="relative flex flex-1 items-center rounded-full border border-themeblue2/20 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                            <input
                                type="text"
                                value={composing?.name ?? ''}
                                onChange={(e) => onComposingNameChange(e.target.value)}
                                placeholder="Order set name..."
                                className="w-full bg-transparent outline-none text-sm text-primary px-3.5 py-2.5 rounded-full min-w-0 placeholder:text-tertiary"
                            />
                        </div>
                    </div>

                    {/* Order sets list */}
                    {(orderSets.length > 0 || stagedAdds.length > 0) ? (
                        <div className="space-y-0.5">
                            {/* Existing order sets */}
                            {orderSets.map(os => {
                                const display = getDisplaySet(os);
                                const isBeingEdited = composing?.editId === os.id;
                                const isMarkedDelete = stagedDeletes.has(os.id);
                                const isEdited = stagedEdits.some(s => s.id === os.id);
                                const tags = collectTags(display);
                                const isClinic = clinicOrderSetIds?.has(os.id) ?? false;
                                const canEdit = !isClinic || (isSupervisorRole ?? false);

                                return (
                                    <div
                                        key={os.id}
                                        onClick={
                                            editing && !composing && canEdit
                                                ? isMarkedDelete
                                                    ? () => onUnstageDelete(os.id)
                                                    : () => onStartEdit(display)
                                                : undefined
                                        }
                                        className={`py-2 px-2 rounded-lg transition-colors ${
                                            isBeingEdited
                                                ? 'ring-1 ring-inset ring-themeblue2/30 bg-themeblue2/5'
                                                : isMarkedDelete
                                                    ? 'ring-1 ring-inset ring-themeredred/30 bg-themeredred/5 cursor-pointer active:scale-[0.98]'
                                                    : isEdited
                                                        ? 'ring-1 ring-inset ring-themeblue2/20 bg-themeblue2/5 cursor-pointer active:scale-[0.98]'
                                                        : editing && !composing && canEdit
                                                            ? 'cursor-pointer active:scale-[0.98] hover:bg-tertiary/5'
                                                            : ''
                                        }`}
                                    >
                                        <div className="flex items-center">
                                            <p className={`text-sm font-medium truncate ${
                                                isMarkedDelete ? 'text-themeredred/60 line-through' : 'text-primary'
                                            }`}>{display.name}</p>
                                            {isClinic && (
                                                <span className="text-[9pt] md:text-[9pt] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary shrink-0 ml-1.5">
                                                    Clinic
                                                </span>
                                            )}
                                        </div>
                                        {tags.length > 0 && (
                                            <p className={`text-[9pt] mt-0.5 pl-0.5 line-clamp-2 ${
                                                isMarkedDelete ? 'text-themeredred/30' : 'text-tertiary'
                                            }`}>
                                                {tags.join(', ')}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Staged adds — dashed blue border */}
                            {stagedAdds.map(os => {
                                const tags = collectTags(os);
                                return (
                                    <div
                                        key={os.id}
                                        data-tour="plan-orderset-staged"
                                        onClick={editing && !composing ? () => onUnstageAdd(os.id) : undefined}
                                        className="py-2 px-2 rounded-lg border border-dashed border-themeblue2/30 bg-themeblue2/5 cursor-pointer active:scale-[0.98] transition-all"
                                    >
                                        <p className="text-sm font-medium text-primary truncate">{os.name}</p>
                                        {tags.length > 0 && (
                                            <p className="text-[9pt] text-tertiary mt-0.5 pl-0.5 line-clamp-2">
                                                {tags.join(', ')}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : !composing ? (
                        <p className="text-sm text-tertiary py-2 text-center">
                            {editing ? 'Name your first order set above' : 'No order sets configured'}
                        </p>
                    ) : null}
                </div>
            </div>
        </section>
    );
};
