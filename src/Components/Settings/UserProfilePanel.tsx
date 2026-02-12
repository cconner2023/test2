import type { UserTypes } from '../../Data/User';
import { credentials, ranks, components } from '../../Data/User';

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

export const UserProfilePanel = ({ profile, onUpdate }: UserProfilePanelProps) => (
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
                    onChange={(val) => onUpdate({ credential: val as UserTypes['credential'] })}
                    options={credentials}
                />

                <SelectInput
                    label="Rank"
                    value={profile.rank ?? ''}
                    onChange={(val) => onUpdate({ rank: val as UserTypes['rank'] })}
                    options={ranks}
                />

                <SelectInput
                    label="Component"
                    value={profile.component ?? ''}
                    onChange={(val) => onUpdate({ component: val as UserTypes['component'] })}
                    options={components}
                />
            </div>

            {profile.lastName && profile.credential && (
                <div className="mt-6 pt-4 border-t border-tertiary/10">
                    <p className="text-xs text-tertiary/60 uppercase tracking-wide mb-1">Signature Preview</p>
                    <p className="text-sm text-primary font-medium">
                        Signed: {profile.lastName} {profile.firstName} {profile.middleInitial}{' '}
                        {profile.credential}
                        {profile.rank ? `, ${profile.rank}` : ''}
                        {profile.component ? `, ${profile.component}` : ''}
                    </p>
                </div>
            )}
        </div>
    </div>
);
