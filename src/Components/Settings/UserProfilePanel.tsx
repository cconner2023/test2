import type { UserTypes } from '../../Data/User';
import { credentials, components, ranksByComponent, unitLevelsByComponent } from '../../Data/User';
import { unitStructure, type UnitNode } from '../../Data/UnitData';

interface UserProfilePanelProps {
    profile: UserTypes;
    onUpdate: (fields: Partial<UserTypes>) => void;
}

const TextInput = ({
    label,
    value,
    onChange,
    placeholder,
    maxLength,
}: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    maxLength?: number;
}) => (
    <label className="block">
        <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">{label}</span>
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                       border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                       transition-colors placeholder:text-tertiary/30"
        />
    </label>
);

const SelectInput = ({
    label,
    value,
    onChange,
    options,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    options: readonly string[];
    placeholder?: string;
}) => (
    <label className="block">
        <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">{label}</span>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                       border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                       transition-colors appearance-none"
        >
            <option value="">{placeholder ?? 'Select...'}</option>
            {options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
            ))}
        </select>
    </label>
);

// ---------------------------------------------------------------------------
// Walk the unit tree to find dropdown options at a given depth
// ---------------------------------------------------------------------------

function getTreeOptionsAtLevel(tree: UnitNode[], selections: string[], level: number): string[] | null {
    let nodes = tree;
    for (let i = 0; i < level; i++) {
        const match = nodes.find(n => n.name === selections[i]);
        if (!match?.children || match.children.length === 0) return null;
        nodes = match.children;
    }
    return nodes.length > 0 ? nodes.map(n => n.name) : null;
}

/** Walk the tree through the current selections, return the UIC of the deepest matched node */
function getUicFromSelection(tree: UnitNode[], selections: string[]): string | undefined {
    let nodes = tree;
    let lastUic: string | undefined;
    for (const sel of selections) {
        const match = nodes.find(n => n.name === sel);
        if (!match) break;
        if (match.uic) lastUic = match.uic;
        nodes = match.children ?? [];
    }
    return lastUic;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const UserProfilePanel = ({ profile, onUpdate }: UserProfilePanelProps) => {
    const componentRanks = profile.component ? ranksByComponent[profile.component] : [];
    const levelNames = profile.component ? unitLevelsByComponent[profile.component] : [];
    const tree = profile.component ? unitStructure[profile.component] ?? [] : [];
    const selections = profile.unitSelections ?? [];

    const handleComponentChange = (val: string) => {
        const newComponent = (val || undefined) as UserTypes['component'];
        const updates: Partial<UserTypes> = { component: newComponent };
        if (profile.rank && (!newComponent || !ranksByComponent[newComponent].includes(profile.rank))) {
            updates.rank = undefined;
        }
        updates.unitSelections = undefined;
        updates.uic = undefined;
        onUpdate(updates);
    };

    const handleUnitChange = (level: number, value: string) => {
        const next = selections.slice(0, level);
        if (value) next.push(value);
        const uic = next.length > 0 ? getUicFromSelection(tree, next) : undefined;
        onUpdate({ unitSelections: next.length > 0 ? next : undefined, uic });
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <p className="text-sm text-tertiary/60 mb-5 md:text-base">
                    Set up your profile for documentation signatures.
                </p>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <TextInput
                            label="First Name"
                            value={profile.firstName ?? ''}
                            onChange={(val) => onUpdate({ firstName: val })}
                            placeholder="Christopher"
                        />
                        <TextInput
                            label="Last Name"
                            value={profile.lastName ?? ''}
                            onChange={(val) => onUpdate({ lastName: val })}
                            placeholder="Conner"
                        />
                    </div>

                    <TextInput
                        label="Middle Initial"
                        value={profile.middleInitial ?? ''}
                        onChange={(val) => onUpdate({ middleInitial: val.toUpperCase().slice(0, 1) })}
                        placeholder="D"
                        maxLength={1}
                    />

                    <SelectInput
                        label="Credential"
                        value={profile.credential ?? ''}
                        onChange={(val) => onUpdate({ credential: (val || undefined) as UserTypes['credential'] })}
                        options={credentials}
                    />

                    <SelectInput
                        label="Component"
                        value={profile.component ?? ''}
                        onChange={handleComponentChange}
                        options={components}
                    />

                    {profile.component && (
                        <SelectInput
                            label="Rank"
                            value={profile.rank ?? ''}
                            onChange={(val) => onUpdate({ rank: val || undefined })}
                            options={componentRanks}
                        />
                    )}

                    {/* Cascading unit selectors */}
                    {profile.component && levelNames.length > 0 && (
                        <div className="pt-2">
                            <p className="text-xs font-medium text-tertiary/60 uppercase tracking-wide mb-3">Unit Information</p>
                            <div className="space-y-3">
                                {levelNames.map((levelName, idx) => {
                                    // Only show if prior level is filled (or it's the first)
                                    if (idx > 0 && !selections[idx - 1]) return null;

                                    const treeOptions = getTreeOptionsAtLevel(tree, selections, idx);

                                    if (treeOptions) {
                                        return (
                                            <SelectInput
                                                key={levelName}
                                                label={levelName}
                                                value={selections[idx] ?? ''}
                                                onChange={(val) => handleUnitChange(idx, val)}
                                                options={treeOptions}
                                            />
                                        );
                                    }

                                    return (
                                        <TextInput
                                            key={levelName}
                                            label={levelName}
                                            value={selections[idx] ?? ''}
                                            onChange={(val) => handleUnitChange(idx, val)}
                                            placeholder={`Enter ${levelName.toLowerCase()}`}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {profile.lastName && profile.credential && (
                    <div className="mt-6 pt-4 border-t border-tertiary/10">
                        <p className="text-xs text-tertiary/60 uppercase tracking-wide mb-1">Signature Preview</p>
                        <p className="text-sm text-primary font-medium">
                            Signed: {profile.lastName} {profile.firstName} {profile.middleInitial}{' '}
                            {profile.credential}
                            {profile.rank ? `, ${profile.rank}` : ''}
                            {profile.component ? `, ${profile.component}` : ''}
                            {profile.uic ? ` | UIC: ${profile.uic}` : ''}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
