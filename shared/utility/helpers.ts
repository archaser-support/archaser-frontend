export const getNestedValue = (obj: Record<string, any>, path: string): any => {
    if (!obj || !path) return undefined;
    return path.split(".").reduce((acc, key) => acc?.[key], obj);
};
