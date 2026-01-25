import React, { useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useServiceWorker } from '../Hooks/useServiceWorker';

const UpdateNotification: React.FC = () => {
    const { updateAvailable, skipWaiting } = useServiceWorker();
    const [isVisible, setIsVisible] = React.useState(false);

    useEffect(() => {
        if (updateAvailable) {
            setIsVisible(true);
        }
    }, [updateAvailable]);

    const handleUpdate = () => {
        skipWaiting();
        setIsVisible(false);
    };

    const handleDismiss = () => {
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-50 pb-4 sm:pb-6">
            <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
                <div className="rounded-lg bg-blue-600 p-4 shadow-lg">
                    <div className="flex flex-wrap items-center justify-between">
                        <div className="flex w-0 flex-1 items-center">
                            <RefreshCw className="h-5 w-5 text-white" />
                            <p className="ml-3 truncate font-medium text-white">
                                <span className="md:hidden">Update available!</span>
                                <span className="hidden md:inline">
                                    A new version of ADTMC is available. Click update to refresh.
                                </span>
                            </p>
                        </div>
                        <div className="order-3 mt-2 w-full flex-shrink-0 sm:order-2 sm:mt-0 sm:w-auto">
                            <button
                                onClick={handleUpdate}
                                className="flex items-center justify-center rounded-md border border-transparent bg-white px-4 py-2 text-sm font-medium text-blue-600 shadow-sm hover:bg-blue-50"
                            >
                                Update Now
                            </button>
                        </div>
                        <div className="order-2 flex-shrink-0 sm:order-3 sm:ml-2">
                            <button
                                type="button"
                                onClick={handleDismiss}
                                className="-mr-1 flex rounded-md p-2 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-white"
                            >
                                <span className="sr-only">Dismiss</span>
                                <X className="h-5 w-5 text-white" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpdateNotification;