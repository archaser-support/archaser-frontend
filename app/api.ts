import axios from "axios";

import store from "@/shared/redux/store";
import {
    getAxiosBaseUrl,
    resolveAuthorizationHeader,
} from "@/utils/apiClientConfig";
import { normalizeProductApiPath } from "@/utils/apiFetch";
import { getNestAccessToken } from "@/utils/nestAuth";
import { shouldAttachNestBearer } from "@/utils/amplifyMode";

const api = axios.create({
    baseURL: getAxiosBaseUrl(),
    headers: {
        "Content-Type": "application/json",
    },
    // Cookie sessions for EC2 hybrid; Nest Bearer mode uses Authorization header.
    withCredentials: !shouldAttachNestBearer(),
});

// Add a request interceptor to include authentication headers
api.interceptors.request.use((config) => {
    // Only increment count for non-GET requests or if explicitly needed
    if (config.method !== "get") {
        store.dispatch({ type: "ADD_REQUEST_COUNT" });
    }

    if (typeof config.url === "string") {
        config.url = normalizeProductApiPath(config.url);
    }

    const existing =
        typeof config.headers?.Authorization === "string"
            ? config.headers.Authorization
            : typeof config.headers?.authorization === "string"
              ? config.headers.authorization
              : null;

    const authorization = resolveAuthorizationHeader({
        existingAuthorization: existing,
        nestAccessToken: getNestAccessToken(),
        attachNestBearer: shouldAttachNestBearer(),
    });
    if (authorization) {
        config.headers = config.headers || {};
        config.headers.Authorization = authorization;
    }

    // Add CSRF token if available (same-origin cookie mode)
    if (!shouldAttachNestBearer()) {
        const csrfToken = document.cookie
            .split("; ")
            .find((row) => row.startsWith("csrf-token="))
            ?.split("=")[1];

        if (csrfToken) {
            config.headers["X-CSRF-Token"] = csrfToken;
        }
    }

    return config;
});

api.interceptors.response.use(
    (response) => {
        // Only decrement count for non-GET requests or if explicitly needed
        if (response.config.method !== "get") {
            store.dispatch({ type: "SUBTRACT_REQUEST_COUNT" });
        }
        return response;
    },
    (error) => {
        // Handle errors and ensure count is decremented
        if (error.config?.method !== "get") {
            store.dispatch({ type: "SUBTRACT_REQUEST_COUNT" });
        }
        return Promise.reject(error);
    }
);

export default api;
export {
    apiFetch,
    resolveProductRequestUrl,
    normalizeProductApiPath,
} from "@/utils/apiFetch";
