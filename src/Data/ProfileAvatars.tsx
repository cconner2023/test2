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
                <rect x="16" y="10" width="8" height="20" rx="2" fill="rgba(255,255,255,0.9)" />
                <rect x="10" y="16" width="20" height="8" rx="2" fill="rgba(255,255,255,0.9)" />
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
        id: 'spartan',
        svg: (
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="20" fill="var(--color-themegreen)" />
                <path d="M10 20c0-7 4.5-13 10-13s10 6 10 13v6c0 1-1 2-2 2h-4l-1-3h-6l-1 3h-4c-1 0-2-1-2-2v-6z" fill="rgba(255,255,255,0.9)" />
                <rect x="14" y="19" width="12" height="4" rx="1" fill="var(--color-themegreen)" />
                <rect x="18" y="15" width="4" height="12" rx="1" fill="var(--color-themegreen)" />
                <path d="M18 7c0 0 1-3 2-3s2 3 2 3v5h-4V7z" fill="rgba(255,255,255,0.85)" />
            </svg>
        ),
    },
];
