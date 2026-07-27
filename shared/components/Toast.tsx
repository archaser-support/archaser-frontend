import React, { useEffect } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({
    message,
    type,
    onClose,
    duration = 5000,
}) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const getIcon = () => {
        switch (type) {
            case "success":
                return <i className="ri-checkbox-circle-line text-green-500" />;
            case "error":
                return <i className="ri-error-warning-line text-red-500" />;
            case "warning":
                return <i className="ri-alert-line text-yellow-500" />;
            case "info":
                return <i className="ri-information-line text-blue-500" />;
            default:
                return null;
        }
    };

    const getBackgroundColor = () => {
        switch (type) {
            case "success":
                return "bg-green-50 dark:bg-green-900/20 border-green-500";
            case "error":
                return "bg-red-50 dark:bg-red-900/20 border-red-500";
            case "warning":
                return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500";
            case "info":
                return "bg-blue-50 dark:bg-blue-900/20 border-blue-500";
            default:
                return "bg-gray-50 dark:bg-gray-900/20 border-gray-500";
        }
    };

    const getTextColor = () => {
        switch (type) {
            case "success":
                return "text-green-700 dark:text-green-300";
            case "error":
                return "text-red-700 dark:text-red-300";
            case "warning":
                return "text-yellow-700 dark:text-yellow-300";
            case "info":
                return "text-blue-700 dark:text-blue-300";
            default:
                return "text-gray-700 dark:text-gray-300";
        }
    };

    return (
        <div
            className={`fixed top-4 right-4 z-50 min-w-[300px] max-w-md rounded-lg border-l-4 p-4 shadow-lg transition-all duration-200 ease-in-out ${getBackgroundColor()}`}
            role="alert"
        >
            <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">{getIcon()}</div>
                <div className="ml-3 flex-1">
                    <p className={`text-sm font-medium ${getTextColor()}`}>
                        {message}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                    <i className="ri-close-line" />
                </button>
            </div>
        </div>
    );
};

export default Toast;
