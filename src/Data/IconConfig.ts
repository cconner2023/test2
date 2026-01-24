export interface IconConfig {
    id: string;
    name: string;
    defaultText?: string;
    defaultOnClick?: () => void;
    width?: number;   // Default CSS width (pixels)
    height?: number;  // Default CSS height (pixels)
    svg: {
        viewBox: string;
        pathData: string | string[];
        strokeWidth?: number;
        strokeLinecap?: 'butt' | 'round' | 'square';
        strokeLinejoin?: 'miter' | 'round' | 'bevel';
        fill?: string;
        stroke?: string;
    };
}

export const iconConfigs: IconConfig[] = [
    {
        id: "home",
        name: "Home",
        defaultText: "Home",
        width: 15,
        height: 34,
        svg: {
            viewBox: "0 0 24 24",
            pathData: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
            strokeWidth: 2,
            fill: "none"
        }
    },
    {
        id: "back",
        name: "Back",
        defaultText: "Back",
        width: 20,
        height: 20,
        svg: {
            viewBox: "0 0 24 24",
            pathData: ["m12 19-7-7 7-7", "M19 12H5"],
            strokeWidth: 2,
            fill: "none"
        }
    },
    {
        id: "download",
        name: "Download",
        defaultText: "Download",
        width: 20,
        height: 20,
        svg: {
            viewBox: "0 0 24 24",
            pathData: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
            strokeWidth: 2,
            fill: "none"
        }
    },

    {
        id: "light",
        name: "light",
        width: 20,
        height: 20,
        svg: {
            // Sun icon (for dark mode button - click to switch to light)
            viewBox: "0 0 24 24",
            pathData: [
                // Sun center
                "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
                // Sun rays
                "M12 2v2",
                "M12 20v2",
                "m4.93 4.93 1.41 1.41",
                "m17.66 17.66 1.41 1.41",
                "M2 12h2",
                "M20 12h2",
                "m6.34 17.66-1.41 1.41",
                "m19.07 4.93-1.41 1.41"
            ],
            strokeWidth: 2,
            fill: "none",
            strokeLinecap: "round",
            strokeLinejoin: "round"
        }
    },
    {
        id: "dark",
        name: "dark",
        width: 20,
        height: 20,
        svg: {
            // Moon icon (for light mode button - click to switch to dark)
            viewBox: "0 0 24 24",
            pathData: [
                "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
            ],
            strokeWidth: 2,
            fill: "none",
            strokeLinecap: "round",
            strokeLinejoin: "round"
        }
    },
    {
        id: "info",
        name: "info",
        defaultText: "info",
        width: 20,
        height: 20,
        svg: {
            viewBox: "0 0 24 24",
            pathData: ["M12 16.5q.214 0 .357-.144T12.5 16v-4.5q0-.213-.144-.356T11.999 11t-.356.144t-.143.356V16q0 .213.144.356t.357.144M12 9.577q.262 0 .439-.177t.176-.438t-.177-.439T12 8.346t-.438.177t-.177.439t.177.438t.438.177M12.003 21q-1.867 0-3.51-.708q-1.643-.709-2.859-1.924t-1.925-2.856T3 12.003t.709-3.51Q4.417 6.85 5.63 5.634t2.857-1.925T11.997 3t3.51.709q1.643.708 2.859 1.922t1.925 2.857t.709 3.509t-.708 3.51t-1.924 2.859t-2.856 1.925t-3.509.709M12 20q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m0-8"],
            strokeWidth: 1,
            fill: "none"
        }
    },

    {
        id: "search",
        name: "Search",
        defaultText: "Search",
        width: 20,
        height: 20,
        svg: {
            viewBox: "0 0 24 24",
            pathData: ["M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"],
            strokeWidth: 2,
            fill: "none"
        }
    },
    {
        id: "arrowLeft",
        name: "Arrow Left",
        defaultText: "Back",
        width: 16,
        height: 16,
        svg: {
            viewBox: "0 0 24 24",
            pathData: ["m12 19-7-7 7-7", "M19 12H5"],
            strokeWidth: 2,
            fill: "none"
        }
    },
    {
        id: "menu",
        name: "Menu",
        defaultText: "Home",
        width: 20,
        height: 20,
        svg: {
            viewBox: "0 0 24 24",
            pathData: ["M3 12h18", "M3 6h18", "M3 18h18"],
            strokeWidth: 2,
            fill: "none"
        }
    },
    {
        id: "pill",
        name: "Pill",
        defaultText: "Medications",
        width: 14,
        height: 14,
        svg: {
            viewBox: "0 0 14 14",
            pathData: ["M6.59 1.69a4.045 4.045 0 1 1 5.72 5.72l-4.9 4.9a4.045 4.045 0 1 1-5.72-5.72zm-2.2 2.2l5.72 5.72"],
            strokeWidth: 1.5,
            fill: "none"
        }
    },
    {
        id: "settings",
        name: "Settings",
        defaultText: "Settings",
        width: 14,
        height: 14,
        svg: {
            viewBox: "0 0 24 24",
            pathData: ["M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
            strokeWidth: 2,
            fill: "none"
        }
    },
    {
        id: "import",
        name: "import",
        defaultText: "import",
        width: 18,
        height: 18,
        svg: {
            viewBox: "0 0 24 24",
            pathData: ["M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
            strokeWidth: 2,
            fill: "none"
        }
    }
];

export const getIconById = (id: string): IconConfig | undefined => {
    return iconConfigs.find(icon => icon.id === id);
};

export type IconId = typeof iconConfigs[number]['id'];