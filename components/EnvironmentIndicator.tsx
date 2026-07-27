"use client";

import { useEffect, useState } from 'react';

import { detectEnvironment, EnvironmentType } from '@/utils/domainUtils';

/**
 * Environment indicator component that shows a colored line at the top of the page
 * - Green line for localhost
 * - Yellow line for preprod
 * - No indicator for production
 */
export default function EnvironmentIndicator() {
    const [environment, setEnvironment] = useState<EnvironmentType>('unknown');

    useEffect(() => {
        // Only run on client side
        if (typeof window !== 'undefined') {
            setEnvironment(detectEnvironment());
        }
    }, []);

    // Don't render anything for production or unknown environments
    if (environment === 'production' || environment === 'unknown') {
        return null;
    }

    return (
        <div 
            className={`environment-indicator ${environment}`}
            title={`Environment: ${environment}`}
        />
    );
}
