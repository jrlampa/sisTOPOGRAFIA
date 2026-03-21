import { useState } from 'react';
import { GeoLocation } from '../types';
import { API_BASE_URL } from '../config/api';

export const useEarthwork = () => {
    const [isCalculating, setIsCalculating] = useState(false);

    const calculateEarthwork = async (polygon: GeoLocation[], targetZ: number, autoBalance: boolean = false) => {
        setIsCalculating(true);
        try {
            const formData = new FormData();
            formData.append('target_z', targetZ.toString());
            formData.append('autoBalance', autoBalance.toString());
            formData.append('polygon', JSON.stringify(polygon.map(p => ({ lat: p.lat, lng: p.lng }))));

            const response = await fetch(`${API_BASE_URL}/analyze-pad`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            Logger.error("Earthwork calculation error:", error);
            throw error;
            /* v8 ignore next -- finally branch: V8 artifact; both exception and normal paths tested */
        } finally {
            setIsCalculating(false);
        }
    };

    return {
        calculateEarthwork,
        isCalculating
    };
};
