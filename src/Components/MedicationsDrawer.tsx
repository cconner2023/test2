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
        <div className="overflow-y-auto h-[calc(100dvh-80px)] md:overflow-y-auto md:h-[60vh]">
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
    const [drawerStage, setDrawerStage] = useState<'partial' | 'full'>('partial');
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
            setDrawerStage('partial');
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

    // Handle drag end with momentum - 3-state: partial ↔ full, close
    const handleDragEnd = () => {
        if (!isDragging || !isMobile) return;

        setIsDragging(false);

        const isSwipingDown = velocityRef.current > 0.3;
        const isSwipingUp = velocityRef.current < -0.3;

        if (drawerStage === 'partial') {
            if (isSwipingUp || drawerPosition > 70) {
                setDrawerStage('full');
                animateToPosition(100);
            } else if (isSwipingDown || drawerPosition < 40) {
                animateToPosition(0);
            } else {
                animateToPosition(100);
            }
        } else {
            if (velocityRef.current > 0.6 || drawerPosition < 30) {
                animateToPosition(0);
            } else if (isSwipingDown || drawerPosition < 70) {
                setDrawerStage('partial');
                animateToPosition(100);
            } else {
                animateToPosition(100);
            }
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
    const mobileHeight = drawerStage === 'partial' ? '40dvh' : '90dvh';
    const mobileHorizontalPadding = drawerStage === 'partial' ? '0.5rem' : '0';
    const mobileBottomPadding = drawerStage === 'partial' ? '1.5rem' : '0';
    const mobileBorderRadius = drawerStage === 'partial' ? '1rem' : '1.25rem 1.25rem 0 0';
    const mobileBoxShadow = drawerStage === 'partial'
        ? '0 4px 2px rgba(0, 0, 0, 0.05)'
        : '0 -4px 20px rgba(0, 0, 0, 0.1)';

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
                <div
                    className={`fixed inset-0 z-60 bg-black ${isDragging ? '' : 'transition-opacity duration-300 ease-out'}`}
                    style={{
                        opacity: (drawerPosition / 100) * 0.3,
                        pointerEvents: drawerPosition > 0 ? 'auto' : 'none',
                    }}
                    onClick={handleClose}
                />
                <div
                    className={`fixed left-0 right-0 z-60 bg-themewhite3 ${isDragging ? '' : 'transition-all duration-300 ease-out'}`}
                    style={{
                        height: mobileHeight,
                        maxHeight: mobileHeight,
                        marginLeft: mobileHorizontalPadding,
                        marginRight: mobileHorizontalPadding,
                        marginBottom: mobileBottomPadding,
                        width: drawerStage === 'partial' ? 'calc(100% - 1rem)' : '100%',
                        bottom: 0,
                        transform: `translateY(${mobileTranslateY}%)`,
                        opacity: mobileOpacity,
                        borderRadius: mobileBorderRadius,
                        willChange: isDragging ? 'transform' : 'auto',
                        touchAction: 'none',
                        boxShadow: mobileBoxShadow,
                        overflow: 'hidden',
                        visibility: isVisible ? 'visible' : 'hidden',
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

            {/* Desktop Container — aligned to left edge of content container */}
            <div className="hidden md:block">
                <div
                    className={`fixed inset-0 z-60 flex items-start justify-center transition-all duration-300 ease-out ${isVisible
                        ? 'visible pointer-events-auto'
                        : 'invisible pointer-events-none'
                        }`}
                    onClick={onClose}
                >
                    <div className="max-w-315 w-full relative">
                        <div
                            className={`absolute left-2 top-2 z-60
                            flex flex-col rounded-xl
                            border border-tertiary/20
                            shadow-[0_2px_4px_0] shadow-themewhite2/20
                            backdrop-blur-md bg-themewhite2/10
                            transform-gpu
                            overflow-hidden
                            text-primary/80 text-sm
                            origin-top-left
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
            </div>
        </>
    );
}
