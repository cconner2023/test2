import { useEffect, useState, useRef, useCallback } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { MedicationPage } from './MedicationPage';
import { medList, type medListTypes } from '../Data/MedData';

interface MedicationsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    selectedMedication: medListTypes | null;
    onMedicationSelect: (medication: medListTypes | null) => void;
    isMobile?: boolean;
}

function MedicationListItem({ medication, isSelected, onClick }: {
    medication: medListTypes;
    isSelected: boolean;
    onClick: () => void;
}) {
    return (
        <div
            className={`flex flex-col py-3 px-2 w-full border-b border-themewhite2/70 cursor-pointer rounded-md ${isSelected ? 'bg-themewhite2' : ''}`}
            onClick={onClick}
        >
            <div className="text-[10pt] font-normal text-primary">
                {medication.icon}
            </div>
            <div className="text-tertiary text-[9pt]">
                {medication.text}
            </div>
        </div>
    );
}

// Shared content component for both mobile and desktop
const MedicationsContent = ({ selectedMedication, onMedicationSelect, onClose }: {
    selectedMedication: medListTypes | null;
    onMedicationSelect: (med: medListTypes | null) => void;
    onClose: () => void;
}) => (
    <>
        {/* Drag Handle - Only visible on mobile */}
        <div className="flex justify-center pt-3 pb-2 md:hidden">
            <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
        </div>

        {/* Header */}
        <div className="px-6 border-b border-tertiary/10 py-4 md:py-5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {selectedMedication && (
                        <button
                            onClick={() => onMedicationSelect(null)}
                            className="p-2 rounded-full hover:bg-themewhite2 active:scale-95 transition-all"
                            aria-label="Back to list"
                        >
                            <ChevronLeft size={24} className="text-tertiary" />
                        </button>
                    )}
                    <h2 className="text-xl font-semibold text-primary md:text-2xl truncate">
                        {selectedMedication ? selectedMedication.text : 'Medications'}
                    </h2>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-themewhite2 md:hover:bg-themewhite active:scale-95 transition-all shrink-0"
                    aria-label="Close"
                >
                    <X size={24} className="text-tertiary" />
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(85vh-80px)] md:overflow-y-auto md:h-[60vh]">
            {selectedMedication ? (
                <MedicationPage medication={selectedMedication} />
            ) : (
                <div className="px-2 pb-4">
                    {medList.map((medication, index) => (
                        <MedicationListItem
                            key={`med-${index}`}
                            medication={medication}
                            isSelected={false}
                            onClick={() => onMedicationSelect(medication)}
                        />
                    ))}
                </div>
            )}
        </div>
    </>
);

export function MedicationsDrawer({
    isVisible,
    onClose,
    selectedMedication,
    onMedicationSelect,
    isMobile: externalIsMobile,
}: MedicationsDrawerProps) {
    const [localIsMobile, setLocalIsMobile] = useState(false);
    const isMobile = externalIsMobile !== undefined ? externalIsMobile : localIsMobile;

    const [drawerPosition, setDrawerPosition] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const dragStartY = useRef(0);
    const dragStartPosition = useRef(0);
    const animationFrameId = useRef<number>(0);
    const velocityRef = useRef(0);
    const lastYRef = useRef(0);
    const lastTimeRef = useRef(0);

    // Check if mobile (only if not provided externally)
    useEffect(() => {
        if (externalIsMobile === undefined) {
            const checkMobile = () => setLocalIsMobile(window.innerWidth < 768);
            checkMobile();
            window.addEventListener('resize', checkMobile);
            return () => window.removeEventListener('resize', checkMobile);
        }
    }, [externalIsMobile]);

    // Handle visibility changes
    useEffect(() => {
        if (isVisible) {
            setDrawerPosition(100);
            document.body.style.overflow = 'hidden';
        } else {
            setDrawerPosition(0);
            document.body.style.overflow = '';
        }

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
                animationFrameId.current = 0;
            }
        };
    }, [isVisible]);

    // Smooth animation function
    const animateToPosition = useCallback((targetPosition: number) => {
        const startPosition = drawerPosition;
        const startTime = performance.now();
        const duration = 300;

        const animate = (timestamp: number) => {
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentPosition = startPosition + (targetPosition - startPosition) * easeProgress;

            setDrawerPosition(currentPosition);

            if (progress < 1) {
                animationFrameId.current = requestAnimationFrame(animate);
            } else {
                animationFrameId.current = 0;
                if (targetPosition === 0) {
                    setTimeout(onClose, 50);
                }
            }
        };

        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }
        animationFrameId.current = requestAnimationFrame(animate);
    }, [drawerPosition, onClose]);

    // Handle drag start
    const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isMobile) return;

        setIsDragging(true);
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragStartY.current = clientY;
        dragStartPosition.current = drawerPosition;
        lastYRef.current = clientY;
        lastTimeRef.current = performance.now();
        velocityRef.current = 0;

        e.stopPropagation();
    };

    // Handle drag move
    const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isDragging || !isMobile) return;

        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const deltaY = clientY - dragStartY.current;

        const currentTime = performance.now();
        const deltaTime = currentTime - lastTimeRef.current;
        if (deltaTime > 0) {
            velocityRef.current = (clientY - lastYRef.current) / deltaTime;
        }

        lastYRef.current = clientY;
        lastTimeRef.current = currentTime;

        const dragSensitivity = 0.8;
        const newPosition = Math.min(100, Math.max(20, dragStartPosition.current - (deltaY * dragSensitivity)));

        setDrawerPosition(newPosition);
        e.stopPropagation();
    };

    // Handle drag end with momentum
    const handleDragEnd = () => {
        if (!isDragging || !isMobile) return;

        setIsDragging(false);

        const shouldClose = velocityRef.current > 0.3 || drawerPosition < 40;
        const shouldOpen = velocityRef.current < -0.3 || drawerPosition > 60;

        if (shouldClose) {
            animateToPosition(0);
        } else if (shouldOpen) {
            animateToPosition(100);
        } else {
            animateToPosition(drawerPosition > 50 ? 100 : 0);
        }
    };

    // Handle close with animation
    const handleClose = () => {
        if (isMobile) {
            animateToPosition(0);
        } else {
            onClose();
        }
    };

    // Mobile drawer styles
    const mobileTranslateY = 100 - drawerPosition;
    const mobileOpacity = Math.min(1, drawerPosition / 60 + 0.2);
    const backdropOpacity = Math.min(0.4, drawerPosition / 100 * 0.4);

    const contentProps = {
        selectedMedication,
        onMedicationSelect,
        onClose: handleClose
    };

    return (
        <>
            {/* Mobile Container */}
            <div
                ref={drawerRef}
                className="md:hidden"
            >
                {/* Backdrop */}
                {isVisible && (
                    <div
                        className={`fixed inset-0 z-30 bg-black ${isDragging ? '' : 'transition-opacity duration-300 ease-out'}`}
                        style={{
                            opacity: backdropOpacity,
                            pointerEvents: drawerPosition > 10 ? 'auto' : 'none'
                        }}
                        onClick={handleClose}
                    />
                )}

                <div
                    className={`fixed left-0 right-0 z-40 bg-themewhite3 shadow-2xl ${isDragging ? '' : 'transition-all duration-300 ease-out'}`}
                    style={{
                        height: '92vh',
                        maxHeight: '92vh',
                        bottom: 0,
                        transform: `translateY(${mobileTranslateY}%)`,
                        opacity: mobileOpacity,
                        borderTopLeftRadius: '1.25rem',
                        borderTopRightRadius: '1.25rem',
                        willChange: isDragging ? 'transform' : 'auto',
                        touchAction: 'none',
                        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)',
                    }}
                    onTouchStart={handleDragStart}
                    onTouchMove={handleDragMove}
                    onTouchEnd={handleDragEnd}
                    onMouseDown={handleDragStart}
                    onMouseMove={handleDragMove}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                >
                    <MedicationsContent {...contentProps} />
                </div>
            </div>

            {/* Desktop Container */}
            <div className="hidden md:block">
                <div
                    className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ease-out ${isVisible
                        ? 'visible pointer-events-auto'
                        : 'invisible pointer-events-none'
                        }`}
                    onClick={onClose}
                >
                    <div
                        className={`fixed right-16 top-15 z-50
                        flex flex-col rounded-xl
                        border border-tertiary/20
                        shadow-[0_2px_4px_0] shadow-themewhite2/20
                        backdrop-blur-md bg-themewhite2/10
                        transform-gpu
                        overflow-hidden
                        text-primary/80 text-sm
                        origin-top-right
                        transition-all duration-300 ease-out
                        max-w-lg
                        w-full
                        ${isVisible
                                ? "scale-x-100 scale-y-100 translate-x-0 translate-y-0"
                                : "opacity-0 scale-x-20 scale-y-20 -translate-x-10 -translate-y-2 pointer-events-none"
                            }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <MedicationsContent {...contentProps} />
                    </div>
                </div>
            </div>
        </>
    );
}
