import { ChartDetailsResponse } from "@/types/ChartDetails";

export const fetchChartDetails = async (
    chartType: string,
    period: string,
    daysRange?: string
): Promise<ChartDetailsResponse> => {
    const searchParams = new URLSearchParams({
        type: chartType,
        period,
    });

    // Add days range filter if provided
    if (daysRange) {
        searchParams.append("daysRange", daysRange);
    }

    const url = `/api/system/dashboard/chart-details?${searchParams.toString()}`;
    // Debug logging removed for production

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Failed to fetch chart details: ${response.statusText}`
        );
    }

    const data = await response.json();
    // Debug logging removed for production
    return data;
};
