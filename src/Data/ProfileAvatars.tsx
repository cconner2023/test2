import type { JSX } from 'react';

export interface ProfileAvatar {
    id: string;
    svg: JSX.Element;
}

export const profileAvatars: ProfileAvatar[] = [
    {
        id: 'doc',
        svg: (
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="20" fill="var(--color-themeredred)" />
                <rect x="16" y="10" width="8" height="20" rx="2" fill="rgba(255,255,255,1)" />
                <rect x="10" y="16" width="20" height="8" rx="2" fill="rgba(255,255,255,1)" />
            </svg>
        ),
    },
    {
        id: 'skull',
        svg: (
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="20" fill="var(--color-themeblue3)" />
                <ellipse cx="20" cy="17" rx="9" ry="9" fill="rgba(255,255,255,1)" />
                <rect x="14" y="24" width="12" height="5" rx="1.5" fill="rgba(255,255,255,1)" />
                <ellipse cx="16.5" cy="16" rx="2.5" ry="3" fill="var(--color-themeblue3)" />
                <ellipse cx="23.5" cy="16" rx="2.5" ry="3" fill="var(--color-themeblue3)" />
                <path d="M19 22 L20 24 L21 22 Z" fill="var(--color-themeblue3)" />
                <rect x="17.5" y="24" width="1" height="5" fill="var(--color-themeblue3)" />
                <rect x="21.5" y="24" width="1" height="5" fill="var(--color-themeblue3)" />
            </svg>
        ),
    },
    {
        id: 'heartbeat',
        svg: (
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="20" fill="var(--color-themeredred)" />
                <polyline
                    points="6,21 13,21 15,16 17,26 19,12 21,28 23,14 25,24 27,21 34,21"
                    stroke="rgba(255,255,255,1)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
            </svg>
        ),
    },
    {
        id: 'sol',
        svg: (
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="20" fill="var(--color-themeblue3)" />
                <g transform="translate(20,20)">
                    <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill="rgba(255,255,255,1)" />
                    <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill="rgba(255,255,255,1)" transform="rotate(60)" />
                    <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill="rgba(255,255,255,1)" transform="rotate(120)" />
                </g>
            </svg>
        ),
    },
    {
        id: 'caduceus',
        svg: (
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="20" fill="var(--color-themeredred)" />
                <rect x="19" y="9" width="2" height="23" rx="1" fill="rgba(255,255,255,1)" />
                <circle cx="20" cy="9" r="2.5" fill="rgba(255,255,255,1)" />
                <path d="M13 12 L17 14" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" />
                <path d="M27 12 L23 14" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" />
                <path d="M20 15 C15 17 15 20 20 22 C25 24 25 27 20 29" stroke="rgba(255,255,255,0.85)" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M20 15 C25 17 25 20 20 22 C15 24 15 27 20 29" stroke="rgba(255,255,255,0.85)" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
        ),
    },

    {
        id: 'atom',
        svg: (
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="20" fill="var(--color-themeblue3)" />
                <circle cx="20" cy="20" r="3" fill="rgba(255,255,255,1)" />
                <ellipse cx="20" cy="20" rx="12" ry="5" stroke="rgba(255,255,255,1)" strokeWidth="1.5" fill="none" />
                <ellipse cx="20" cy="20" rx="12" ry="5" stroke="rgba(255,255,255,1)" strokeWidth="1.5" fill="none" transform="rotate(60 20 20)" />
                <ellipse cx="20" cy="20" rx="12" ry="5" stroke="rgba(255,255,255,1)" strokeWidth="1.5" fill="none" transform="rotate(120 20 20)" />
            </svg>
        ),
    },
    {
        id: 'medic',
        svg: (
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="20" fill="var(--color-themeredred)" />
                <path d="M20 8 L30 13 V22 C30 27 25 32 20 34 C15 32 10 27 10 22 V13 Z" fill="rgba(255,255,255,1)" />
                <rect x="18" y="15" width="4" height="12" rx="1" fill="var(--color-themeredred)" />
                <rect x="14" y="19" width="12" height="4" rx="1" fill="var(--color-themeredred)" />
            </svg>
        ),
    },


];
