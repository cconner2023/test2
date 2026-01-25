import React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useServiceWorker } from '../Hooks/useServiceWorker';

const UpdateNotification: React.FC = () => {
    const { updateAvailable, skipWaiting } = useServiceWorker();
    const [dismissed, setDismissed] = React.useState(false);

    if (!updateAvailable || dismissed) return null;

    const handleUpdate = () => {
        skipWaiting();
        setDismissed(true);
    };

    const handleDismiss = () => {
        setDismissed(true);
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-center">
                        <div className="shrink-0">
                            <RefreshCw className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                                Update Available
                            </h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                A new version of ADTMC is available. Update to get the latest features.
                            </p>
                            <div className="mt-3 flex gap-2">
                                <button
                                    onClick={handleUpdate}
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Update Now
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Later
                                </button>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-500"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpdateNotification;