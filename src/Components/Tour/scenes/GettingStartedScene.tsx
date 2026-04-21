import { useState, useEffect } from 'react';
import { User, BookOpen, Mail, CalendarDays, Settings, Upload } from 'lucide-react';

interface GettingStartedSceneProps {
  currentStep: number;
  isMobile: boolean;
}

const MOBILE_MENU_ITEMS = [
  { action: 'import', Icon: Upload, label: 'Import Note' },
  { action: 'knowledgebase', Icon: BookOpen, label: 'Knowledge Base' },
  { action: 'calendar', Icon: CalendarDays, label: 'Calendar' },
  { action: 'settings', Icon: Settings, label: 'Settings' },
] as const;

const DESKTOP_MENU_ITEMS = [
  { action: 'calendar', Icon: CalendarDays, label: 'Calendar' },
  { action: 'settings', Icon: Settings, label: 'Settings' },
] as const;

const CATEGORY_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const NAV_WIDTH = 280;

export default function GettingStartedScene({ currentStep, isMobile }: GettingStartedSceneProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const sidenavOpen = currentStep >= 1;
  const menuItems = isMobile ? MOBILE_MENU_ITEMS : DESKTOP_MENU_ITEMS;

  return (
    <div
      data-tour-scene
      className="fixed inset-0 z-[9996] transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {/* Background — matches real app's outer shell */}
      <div className={`h-full w-full flex items-center justify-center ${isMobile ? '' : 'bg-themewhite2'}`}>
        {/* App container — matches #app-drawer-root */}
        <div
          className={`flex flex-col relative overflow-hidden ${
            isMobile
              ? 'w-full h-full'
              : 'max-w-315 w-full m-5 h-[85%] rounded-md border border-[rgba(0,0,0,0.03)] shadow-[0px_2px_4px] shadow-[rgba(0,0,0,0.1)] bg-themewhite'
          }`}
        >
          {/* Viewport strip — SideNav + content side by side, slides to reveal nav */}
          <div
            className="flex h-full transition-transform duration-300"
            style={{
              width: `calc(100% + ${NAV_WIDTH}px)`,
              transform: `translateX(${sidenavOpen ? 0 : -NAV_WIDTH}px)`,
              transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          >
            {/* SideNav panel */}
            <div
              className="h-full shrink-0 bg-themewhite flex flex-col"
              style={{
                width: NAV_WIDTH,
                paddingTop: isMobile ? 'var(--sat)' : undefined,
              }}
            >
              {/* Profile Card */}
              <div
                data-tour="sidenav-profile"
                className={`flex items-center gap-3 mx-3 mt-3 mb-2 px-4 rounded-xl ${
                  isMobile ? 'py-3.5' : 'py-2.5'
                }`}
              >
                <div
                  className={`rounded-full bg-themeblue3/10 flex items-center justify-center shrink-0 ${
                    isMobile ? 'w-11 h-11' : 'w-9 h-9'
                  }`}
                >
                  <User size={20} className="text-themeblue3/40" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-primary">SPC Smith</span>
                  <span className="text-xs text-secondary">68W · Combat Medic</span>
                </div>
              </div>

              <div className="mx-4 border-t border-tertiary/10" />

              {/* Menu Items */}
              <div className="flex flex-col flex-1 px-3 pt-2">
                {menuItems.map(({ action, Icon, label }) => (
                  <div
                    key={action}
                    data-tour={`sidenav-${action}`}
                    className={`w-full text-left flex items-center rounded-xl ${
                      isMobile
                        ? 'pl-7 pr-4 py-3.5'
                        : 'pl-5 pr-3 py-2.5'
                    }`}
                  >
                    <Icon
                      size={isMobile ? 20 : 16}
                      className="mr-4 text-primary"
                    />
                    <span
                      className={`tracking-wide font-medium ${
                        isMobile
                          ? 'text-[11pt] text-primary'
                          : 'text-[10pt] text-primary'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div
                className="border-t border-tertiary/10 px-4 py-4 text-center"
                style={{ paddingBottom: 'calc(var(--sab, 0px) + 1rem)' }}
              >
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-themegreen" />
                  <span className="text-[9pt] font-medium text-themegreen">Connected</span>
                </div>
              </div>
            </div>

            {/* Content column — takes remaining width */}
            <div className="flex flex-col h-full flex-1 min-w-0">
              {/* NavTop */}
              {isMobile ? (
                <div className="h-14 shrink-0 bg-themewhite flex items-center justify-between px-3">
                  <div className="rounded-full bg-themewhite border border-tertiary/20 p-0.5 aspect-square">
                    <button
                      data-tour="menu-button"
                      className="w-[2.6875rem] h-[2.6875rem] rounded-full bg-themeblue3/10 flex items-center justify-center"
                    >
                      <User size={20} className="text-themeblue3/40" />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-primary tracking-wider">ADTMC</span>
                  <div className="rounded-full bg-themewhite border border-tertiary/20 p-0.5 aspect-square">
                    <button className="w-[2.6875rem] h-[2.6875rem] rounded-full flex items-center justify-center">
                      <Mail size={20} className="text-primary" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-14 shrink-0 bg-themewhite flex items-center px-3 rounded-t-md">
                  <div className="flex items-center gap-2">
                    <button
                      data-tour="menu-button"
                      className="w-8 h-8 rounded-full bg-themeblue3/10 flex items-center justify-center"
                    >
                      <User size={16} className="text-themeblue3/40" />
                    </button>
                    <button className="h-8 flex items-center px-3 py-1.5 bg-themewhite2 rounded-full">
                      <BookOpen size={16} className="stroke-themeblue1" />
                      <span className="text-[10pt] text-tertiary ml-2">Knowledge Base</span>
                    </button>
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2 ml-4 mr-2">
                    <div className="flex-1 min-w-0 rounded-full border border-themeblue3/20 shadow-xs bg-themewhite">
                      <input
                        type="text"
                        placeholder="Search"
                        readOnly
                        className="w-full text-sm text-tertiary px-4 py-1.5 bg-transparent outline-none"
                      />
                    </div>
                    <button className="h-8 flex items-center px-3 py-1.5 bg-themewhite2 rounded-full">
                      <Upload size={16} className="stroke-themeblue1" />
                      <span className="text-[10pt] text-tertiary ml-2">Import</span>
                    </button>
                    <button className="h-8 flex items-center px-3 py-1.5 bg-themewhite2 rounded-full">
                      <Mail size={16} className="stroke-themeblue1" />
                    </button>
                  </div>
                </div>
              )}

              {/* Main Area — Category Rows */}
              <div className="flex-1 bg-themewhite overflow-hidden">
                {CATEGORY_LABELS.map((letter) => (
                  <div
                    key={letter}
                    className="flex py-3 px-2 w-full border-b border-themewhite2/90"
                  >
                    <div className="px-3 py-2 flex text-[10pt] font-bold items-center justify-center shrink-0 bg-themeblue3 text-white rounded-md">
                      {letter}
                    </div>
                    <div className="h-full flex-1 min-w-0 p-[4px_10px_4px_10px] text-tertiary text-[10pt] flex items-center">
                      Category {letter}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
