/**
 * Shared types and constants for the Settings panel system.
 */
import type React from 'react';

/** Named panel IDs — replaces the old magic-integer system. */
export const PANEL = {
    CLOSE: -1,
    BACK_TO_MAIN: -2,
    TOGGLE_THEME: 0,
    MY_NOTES: 1,
    RELEASE_NOTES: 4,
    AVATAR_PICKER: 5,
    USER_PROFILE: 6,
    TRAINING: 7,
    ADMIN: 8,
    SUPERVISOR: 9,
    GUEST_OPTIONS: 11,
    PROFILE_CHANGE_REQUEST: 12,
    LOGIN: 14,
    PIN_SETUP: 15,
    FEEDBACK: 16,
    NOTIFICATION_SETTINGS: 17,
    HOW_TO: 18,
    NOTE_CONTENT: 19,
} as const;

export type PanelId = (typeof PANEL)[keyof typeof PANEL];

/** Maps a numeric panel ID to the activePanel string it should navigate to. */
export const PANEL_TARGET: Partial<Record<PanelId, string>> = {
    [PANEL.MY_NOTES]: 'my-notes',
    [PANEL.RELEASE_NOTES]: 'release-notes',
    [PANEL.AVATAR_PICKER]: 'avatar-picker',
    [PANEL.USER_PROFILE]: 'user-profile',
    [PANEL.TRAINING]: 'training',
    [PANEL.ADMIN]: 'admin',
    [PANEL.SUPERVISOR]: 'supervisor',
    [PANEL.GUEST_OPTIONS]: 'guest-options',
    [PANEL.PROFILE_CHANGE_REQUEST]: 'profile-change-request',
    [PANEL.LOGIN]: 'login',
    [PANEL.PIN_SETUP]: 'pin-setup',
    [PANEL.FEEDBACK]: 'feedback',
    [PANEL.NOTIFICATION_SETTINGS]: 'notification-settings',
    [PANEL.HOW_TO]: 'how-to',
    [PANEL.NOTE_CONTENT]: 'note-content',
};

export type SettingsItem =
    | { type: 'option'; icon: React.ReactNode; label: string; action: () => void; color: string; id: PanelId; disabled?: boolean }
    | { type: 'header'; label: string };
