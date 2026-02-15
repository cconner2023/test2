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
        id: 'dino',
        svg: (
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="20" fill="var(--color-themeblue3)" />
                <path d="M10 14c0-3 3-6 8-6h6c4 0 7 3 7 7v8c0 3-2 5-5 5H15c-3 0-5-2-5-5V14z" fill="rgba(255,255,255,0.9)" />
                <polygon points="13,8 15,13 11,13" fill="rgba(255,255,255,0.8)" />
                <polygon points="19,5 21,11 17,11" fill="rgba(255,255,255,0.8)" />
                <polygon points="25,6 27,12 23,12" fill="rgba(255,255,255,0.8)" />
                <circle cx="25" cy="16" r="2.5" fill="var(--color-themeblue3)" />
                <circle cx="25.5" cy="15.5" r="1" fill="rgba(255,255,255,0.5)" />
                <ellipse cx="28" cy="22" rx="3" ry="1.5" fill="var(--color-themeblue3)" opacity="0.4" />
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
    {
        id: 'drip',
        svg: (
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="20" fill="var(--color-themepurple)" />
                <path d="M8 16c0-5 5-9 12-9s12 4 12 9v4c0 3-5 5-12 5S8 23 8 20v-4z" fill="rgba(255,255,255,0.9)" />
                <ellipse cx="13" cy="27" rx="2" ry="4" fill="rgba(255,255,255,1)" />
                <ellipse cx="20" cy="28" rx="2.5" ry="4" fill="rgba(255,255,255,1)" />
                <ellipse cx="27" cy="27" rx="2" ry="4" fill="rgba(255,255,255,1)" />
                <circle cx="16" cy="16" r="2.5" fill="var(--color-themepurple)" />
                <circle cx="24" cy="16" r="2.5" fill="var(--color-themepurple)" />
                <circle cx="16.5" cy="15.5" r="1" fill="rgba(255,255,255,0.5)" />
                <circle cx="24.5" cy="15.5" r="1" fill="rgba(255,255,255,0.5)" />
                <ellipse cx="20" cy="20" rx="3" ry="1.5" fill="var(--color-themepurple)" opacity="0.3" />
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
        id: 'bub',
        svg: (
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="20" fill="var(--color-themegreen)" />
                <path d="M9 19c0-5 5-10 11-10s11 5 11 10v4c0 5-5 9-11 9S9 28 9 23v-4z" fill="rgba(255,255,255,0.9)" />
                <circle cx="14" cy="10" r="3" fill="rgba(255,255,255,0.8)" />
                <circle cx="22" cy="7" r="3.5" fill="rgba(255,255,255,0.8)" />
                <circle cx="29" cy="12" r="2.5" fill="rgba(255,255,255,0.8)" />
                <circle cx="23" cy="19" r="3" fill="var(--color-themegreen)" />
                <circle cx="23.5" cy="18.5" r="1.2" fill="rgba(255,255,255,0.5)" />
                <ellipse cx="14" cy="23" rx="3" ry="1.5" fill="var(--color-themegreen)" opacity="0.3" />
            </svg>
        ),
    },
    {
        id: 'caduceus',
        svg: (
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="20" fill="var(--color-themepurple)" />
                <rect x="19" y="9" width="2" height="23" rx="1" fill="rgba(255,255,255,1)" />
                <circle cx="20" cy="9" r="2.5" fill="rgba(255,255,255,1)" />
                <path d="M13 12 L17 14" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" />
                <path d="M27 12 L23 14" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" />
                <path d="M20 15 C15 17 15 20 20 22 C25 24 25 27 20 29" stroke="rgba(255,255,255,0.85)" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M20 15 C25 17 25 20 20 22 C15 24 15 27 20 29" stroke="rgba(255,255,255,0.85)" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
        ),
    },
];
