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
    const [drawerStage, setDrawerStage] = useState<'partial' | 'full'>('partial');
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
        const target = e.target as HTMLElement;
        if (!target.closest('[data-drag-zone]')) return;

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

    // Handle drag end with momentum - partial ↔ full, close
    const handleDragEnd = () => {
        if (!isDragging) return;

        setIsDragging(false);

        const isSwipingDown = velocityRef.current > 0.3;
        const isSwipingUp = velocityRef.current < -0.3;

        if (drawerStage === 'partial') {
            if (isSwipingUp) {
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
    const mobileHeight = drawerStage === 'partial' ? '40dvh' : '90dvh';
    const mobileHorizontalPadding = drawerStage === 'partial' ? '0.5rem' : '0';
    const mobileBottomPadding = drawerStage === 'partial' ? '1.5rem' : '0';
    const mobileBorderRadius = drawerStage === 'partial' ? '1rem' : '1.25rem 1.25rem 0 0';
    const mobileBoxShadow = drawerStage === 'partial'
        ? '0 4px 2px rgba(0, 0, 0, 0.05)'
        : '0 -4px 20px rgba(0, 0, 0, 0.1)';

    return (
        <>
            {/* Mobile Drawer */}
            <div ref={drawerRef} className="md:hidden">
                <div
                    className={`fixed inset-0 z-60 bg-black ${isDragging ? '' : 'transition-opacity duration-300 ease-out'}`}
                    style={{
                        opacity: (drawerPosition / 100) * 0.3,
                        pointerEvents: drawerPosition > 0 ? 'auto' : 'none',
                    }}
                    onClick={handleClose}
                />
                <div
                    className={`fixed left-0 right-0 z-60 bg-themewhite3 flex flex-col ${isDragging ? '' : 'transition-all duration-300 ease-out'}`}
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
                    {/* Drag Handle */}
                    <div className="flex justify-center pt-3 pb-2" data-drag-zone style={{ touchAction: 'none' }}>
                        <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
                    </div>

                    {/* Header */}
                    <div className="px-6 border-b border-tertiary/10 py-4" data-drag-zone style={{ touchAction: 'none' }}>
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
            </div>
        </>
    );
}
