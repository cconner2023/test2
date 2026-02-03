import { X } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import type { catDataTypes, subCatDataTypes, SearchResultType } from '../Types/CatTypes';

interface SymptomInfoDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    selectedSymptom: subCatDataTypes | null;
    selectedCategory: catDataTypes | null;
    onNavigate: (result: SearchResultType) => void;
}

export function SymptomInfoDrawer({
    isVisible,
    onClose,
    selectedSymptom,
    selectedCategory,
    onNavigate
}: SymptomInfoDrawerProps) {
    const [drawerPosition, setDrawerPosition] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const dragStartY = useRef(0);
    const dragStartPosition = useRef(0);
    const animationFrameId = useRef<number>(0);
    const velocityRef = useRef(0);
    const lastYRef = useRef(0);
    const lastTimeRef = useRef(0);

    // Handle visibility changes
    useEffect(() => {
        if (isVisible) {
            setDrawerPosition(100);
        } else {
            setDrawerPosition(0);
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

            // Ease out cubic for iOS-like feel
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
        if (!isDragging) return;

        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const deltaY = clientY - dragStartY.current;

        // Calculate velocity
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
        if (!isDragging) return;

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
        animateToPosition(0);
    };

    if (!isVisible || !selectedSymptom || !selectedCategory) return null;

    const handleGuidelineClick = (
        type: 'gen' | 'medcom' | 'stp' | 'DDX',
        item: any,
        index: number
    ) => {
        onNavigate({
            type: type === 'DDX' ? 'DDX' : 'training',
            id: item.id || index,
            icon: item.icon || (type === 'DDX' ? 'DDX' : '📝'),
            text: item.text,
            data: {
                categoryId: selectedCategory.id,
                symptomId: selectedSymptom.id,
                categoryRef: selectedCategory,
                symptomRef: selectedSymptom,
                guidelineType: type === 'DDX' ? undefined : type,
                guidelineId: item.id || index
            }
        });
        handleClose();
    };

    const mobileTranslateY = 100 - drawerPosition;
    const mobileOpacity = Math.min(1, drawerPosition / 60 + 0.2);
    const backdropOpacity = Math.min(0.4, drawerPosition / 100 * 0.4);

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black z-40 md:hidden ${isDragging ? '' : 'transition-opacity duration-300 ease-out'}`}
                style={{
                    opacity: backdropOpacity,
                    pointerEvents: drawerPosition > 10 ? 'auto' : 'none'
                }}
                onClick={handleClose}
            />

            {/* Drawer */}
            <div
                ref={drawerRef}
                className={`fixed left-0 right-0 z-50 bg-themewhite flex flex-col md:hidden ${isDragging ? '' : 'transition-all duration-300 ease-out'}`}
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
                {/* Drag Handle */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
                </div>

                {/* Header */}
                <div className="px-6 border-b border-tertiary/10 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="text-2xl">{selectedSymptom.icon}</div>
                            <h2 className="text-xl font-semibold text-primary">{selectedSymptom.text}</h2>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 rounded-full hover:bg-themewhite2 active:scale-95 transition-all"
                            aria-label="Close"
                        >
                            <X size={24} className="text-tertiary" />
                        </button>
                    </div>
                    {selectedSymptom.description && (
                        <p className="text-sm text-secondary">{selectedSymptom.description}</p>
                    )}
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 px-6 py-4">
                    {/* Differentials */}
                    {selectedSymptom.DDX && selectedSymptom.DDX.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-base font-semibold text-primary mb-3">Differentials</h3>
                            <div className="space-y-2">
                                {selectedSymptom.DDX.map((ddx, index) => (
                                    <div
                                        key={`ddx-${index}`}
                                        onClick={() => handleGuidelineClick('DDX', ddx, index)}
                                        className="p-3 rounded-lg border border-themewhite2/50 cursor-pointer hover:bg-themewhite2 active:scale-[0.98] transition-all"
                                    >
                                        <div className="text-sm text-secondary">{ddx.text}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Guidelines */}
                    {(selectedSymptom.gen?.length > 0 || selectedSymptom.medcom?.length > 0 || selectedSymptom.stp?.length > 0) && (
                        <div>
                            <h3 className="text-base font-semibold text-primary mb-3">Guidelines</h3>
                            <div className="space-y-2">
                                {selectedSymptom.gen?.map((item, index) => (
                                    <div
                                        key={`gen-${index}`}
                                        onClick={() => handleGuidelineClick('gen', item, index)}
                                        className="p-3 rounded-lg border border-themewhite2/50 cursor-pointer hover:bg-themewhite2 active:scale-[0.98] transition-all"
                                    >
                                        <div className="text-sm text-secondary">{item.text}</div>
                                    </div>
                                ))}
                                {selectedSymptom.medcom?.map((item, index) => (
                                    <div
                                        key={`medcom-${index}`}
                                        onClick={() => handleGuidelineClick('medcom', item, index)}
                                        className="p-3 rounded-lg border border-themewhite2/50 cursor-pointer hover:bg-themewhite2 active:scale-[0.98] transition-all"
                                    >
                                        <div className="text-sm text-secondary">{item.text}</div>
                                    </div>
                                ))}
                                {selectedSymptom.stp?.map((item, index) => (
                                    <div
                                        key={`stp-${index}`}
                                        onClick={() => handleGuidelineClick('stp', item, index)}
                                        className="p-3 rounded-lg border border-themewhite2/50 cursor-pointer hover:bg-themewhite2 active:scale-[0.98] transition-all"
                                    >
                                        <div className="text-sm text-secondary">{item.text}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
