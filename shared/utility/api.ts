import { apiFetch } from "@/utils/apiFetch";

export const fetcher = async (url: string) => {
    const response = await apiFetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
};
