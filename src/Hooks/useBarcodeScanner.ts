// hooks/useBarcodeScanner.ts
import { useState, useRef, useCallback, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';

interface ScannerState {
    isScanning: boolean;
    error: string | null;
    result: string | null;
}

export const useBarcodeScanner = () => {
    const [state, setState] = useState<ScannerState>({
        isScanning: false,
        error: null,
        result: null,
    });

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const readerRef = useRef<BrowserMultiFormatReader | null>(null);
    const scanningRef = useRef(false);

    // Cleanup camera stream
    const stopCamera = useCallback(() => {
        scanningRef.current = false;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (readerRef.current) {
            readerRef.current.reset();
            readerRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    // Start camera and scanning
    const startScanning = useCallback(async (video: HTMLVideoElement) => {
        if (scanningRef.current) return;

        videoRef.current = video;
        setState(prev => ({ ...prev, isScanning: true, error: null, result: null }));
        scanningRef.current = true;

        try {
            // Request camera access - prefer back camera on mobile
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                }
            });

            streamRef.current = stream;
            video.srcObject = stream;
            await video.play();

            // Use multi-format reader for barcode support including Data Matrix
            const reader = new BrowserMultiFormatReader();
            readerRef.current = reader;

            // Continuous decode from our managed stream (not decodeFromVideoDevice which creates its own)
            reader.decodeFromStream(
                stream,
                video,
                (result, error) => {
                    if (!scanningRef.current) return;

                    if (result) {
                        const text = result.getText();
                        setState(prev => ({ ...prev, result: text, isScanning: false }));
                        stopCamera();
                    }
                    // Ignore decode errors during continuous scanning (expected when no barcode in view)
                }
            ).catch(err => {
                if (scanningRef.current) {
                    setState(prev => ({
                        ...prev,
                        error: err.message || 'Failed to start barcode scanner',
                        isScanning: false
                    }));
                    stopCamera();
                }
            });

        } catch (err: any) {
            let errorMessage = 'Camera access denied';
            if (err.name === 'NotAllowedError') {
                errorMessage = 'Camera permission denied. Please allow camera access.';
            } else if (err.name === 'NotFoundError') {
                errorMessage = 'No camera found on this device.';
            } else if (err.name === 'NotReadableError') {
                errorMessage = 'Camera is in use by another application.';
            } else if (err.message) {
                errorMessage = err.message;
            }

            setState(prev => ({ ...prev, error: errorMessage, isScanning: false }));
            stopCamera();
        }
    }, [stopCamera]);

    // Stop scanning
    const stopScanning = useCallback(() => {
        stopCamera();
        setState(prev => ({ ...prev, isScanning: false }));
    }, [stopCamera]);

    // Clear result
    const clearResult = useCallback(() => {
        setState(prev => ({ ...prev, result: null, error: null }));
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    return {
        isScanning: state.isScanning,
        error: state.error,
        result: state.result,
        startScanning,
        stopScanning,
        clearResult,
    };
};
