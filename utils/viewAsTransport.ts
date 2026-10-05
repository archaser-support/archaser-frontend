/**
 * Mirror view-as onto request headers / SSE query for Nest DualAuth when the
 * NextAuth cookie is not sent cross-origin (Amplify → Nest API).
 */

const VIEW_AS_STORAGE_KEY = "archaser_view_as";

export type ViewAsSnapshot = {
    view_as_user_id: string;
    view_as_user_role?: string | null;
    view_as_user_account_id?: number | null;
    view_as_user_name?: string | null;
    view_as_user_account_name?: string | null;
};

export function persistViewAsSnapshot(snapshot: ViewAsSnapshot | null): void {
    if (typeof window === "undefined") {
        return;
    }
    if (!snapshot?.view_as_user_id) {
        sessionStorage.removeItem(VIEW_AS_STORAGE_KEY);
        localStorage.removeItem(VIEW_AS_STORAGE_KEY);
        return;
    }
    const json = JSON.stringify(snapshot);
    sessionStorage.setItem(VIEW_AS_STORAGE_KEY, json);
    localStorage.setItem(VIEW_AS_STORAGE_KEY, json);
}

export function readViewAsSnapshot(): ViewAsSnapshot | null {
    if (typeof window === "undefined") {
        return null;
    }
    const raw =
        sessionStorage.getItem(VIEW_AS_STORAGE_KEY) ||
        localStorage.getItem(VIEW_AS_STORAGE_KEY);
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw) as ViewAsSnapshot;
        if (
            typeof parsed?.view_as_user_id !== "string" ||
            !parsed.view_as_user_id.trim()
        ) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function applyViewAsHeaders(
    headers: Headers | Record<string, string>
): void {
    const snapshot = readViewAsSnapshot();
    if (!snapshot) {
        return;
    }
    const set = (key: string, value: string) => {
        if (headers instanceof Headers) {
            headers.set(key, value);
        } else {
            headers[key] = value;
        }
    };
    set("X-Archaser-View-As-User-Id", snapshot.view_as_user_id);
    if (snapshot.view_as_user_role) {
        set("X-Archaser-View-As-User-Role", snapshot.view_as_user_role);
    }
    if (snapshot.view_as_user_account_id != null) {
        set(
            "X-Archaser-View-As-User-Account-Id",
            String(snapshot.view_as_user_account_id)
        );
    }
    if (snapshot.view_as_user_name) {
        set("X-Archaser-View-As-User-Name", snapshot.view_as_user_name);
    }
    if (snapshot.view_as_user_account_name) {
        set(
            "X-Archaser-View-As-User-Account-Name",
            snapshot.view_as_user_account_name
        );
    }
}

export function appendViewAsQueryParams(url: string): string {
    const snapshot = readViewAsSnapshot();
    if (!snapshot) {
        return url;
    }
    const u = new URL(
        url,
        typeof window !== "undefined"
            ? window.location.origin
            : "http://localhost"
    );
    u.searchParams.set("view_as_user_id", snapshot.view_as_user_id);
    if (snapshot.view_as_user_role) {
        u.searchParams.set("view_as_user_role", snapshot.view_as_user_role);
    }
    if (snapshot.view_as_user_account_id != null) {
        u.searchParams.set(
            "view_as_user_account_id",
            String(snapshot.view_as_user_account_id)
        );
    }
    if (snapshot.view_as_user_name) {
        u.searchParams.set("view_as_user_name", snapshot.view_as_user_name);
    }
    if (snapshot.view_as_user_account_name) {
        u.searchParams.set(
            "view_as_user_account_name",
            snapshot.view_as_user_account_name
        );
    }
    // Keep relative paths relative when input was relative.
    if (url.startsWith("http://") || url.startsWith("https://")) {
        return u.toString();
    }
    return `${u.pathname}${u.search}`;
}
