/**
 * Shared types and constants for the Settings panel system.
 */
import type React from 'react';

/** Named panel IDs — replaces the old magic-integer system. */
export const PANEL = {
    CLOSE: -1,
    BACK_TO_MAIN: -2,
    TOGGLE_THEME: 0,
    RELEASE_NOTES: 4,
    AVATAR_PICKER: 5,
    USER_PROFILE: 6,
    ADMIN: 8,
    SUPERVISOR: 9,
    PROFILE_CHANGE_REQUEST: 12,
    PIN_SETUP: 15,
    FEEDBACK: 16,
    NOTIFICATION_SETTINGS: 17,
    NOTE_CONTENT: 19,
    PRIVACY_POLICY: 21,
    CHANGE_PASSWORD: 22,
    CERTIFICATIONS: 23,
    LORA: 26,
    SESSIONS_DEVICES: 27,
    CLINIC: 28,
    CLINIC_ADD_MEMBER: 29,
    PHYSICAL_EXAM: 30,
    PLAN_SETTINGS: 31,
    TEXT_TEMPLATES: 32,
    PROVIDER_TEMPLATES: 33,
    GUIDED_TOURS: 34,
    TC3_MODE: 35,
} as const;

export type PanelId = (typeof PANEL)[keyof typeof PANEL];

/** Maps a numeric panel ID to the activePanel string it should navigate to. */
export const PANEL_TARGET: Partial<Record<PanelId, string>> = {
    [PANEL.RELEASE_NOTES]: 'release-notes',
    [PANEL.AVATAR_PICKER]: 'avatar-picker',
    [PANEL.USER_PROFILE]: 'user-profile',
    [PANEL.ADMIN]: 'admin',
    [PANEL.PROFILE_CHANGE_REQUEST]: 'profile-change-request',
    [PANEL.PIN_SETUP]: 'pin-setup',
    [PANEL.FEEDBACK]: 'feedback',
    [PANEL.NOTIFICATION_SETTINGS]: 'notification-settings',
    [PANEL.NOTE_CONTENT]: 'note-content',
    [PANEL.PRIVACY_POLICY]: 'privacy-policy',
    [PANEL.CHANGE_PASSWORD]: 'change-password',
    [PANEL.CERTIFICATIONS]: 'certifications',
    [PANEL.LORA]: 'lora',
    [PANEL.SESSIONS_DEVICES]: 'sessions-devices',
    [PANEL.CLINIC]: 'clinic',
    [PANEL.CLINIC_ADD_MEMBER]: 'clinic-add-member',
    [PANEL.PHYSICAL_EXAM]: 'physical-exam',
    [PANEL.PLAN_SETTINGS]: 'plan-settings',
    [PANEL.TEXT_TEMPLATES]: 'text-templates',
    [PANEL.PROVIDER_TEMPLATES]: 'provider-templates',
    [PANEL.GUIDED_TOURS]: 'guided-tours',
};

export type SettingsItem =
    | { type: 'option'; icon: React.ReactNode; label: string; subtitle?: string; action: () => void; color: string; id: PanelId; disabled?: boolean; badge?: number }
    | { type: 'header'; label: string };
