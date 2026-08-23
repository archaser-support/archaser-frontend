"use client";

import {
    Person as PersonIcon,
    Description as DescriptionIcon,
    ContactMail as ContactMailIcon,
    Gavel as GavelIcon,
    Search as SearchIcon,
    History as HistoryIcon,
    KeyboardArrowRight as ArrowRightIcon,
    Business as BusinessIcon,
    Close as CloseIcon,
    Keyboard as KeyboardIcon,
} from "@mui/icons-material";
import {
    Autocomplete,
    TextField,
    CircularProgress,
    Box,
    Typography,
    Chip,
    Popper,
    useTheme,
    useMediaQuery,
    Skeleton,
    Alert,
    Divider,
    ListSubheader,
    InputAdornment,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
    useMemo,
} from "react";
import { useTranslation } from "react-i18next";

import api from "@/app/api";
import {
    searchGlobal,
    GlobalSearchResult,
} from "@/shared/services/globalSearchService";
import AppUrls from "@/utils/appUrls";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";

interface GlobalSearchProps {
    isHebrewUser?: boolean;
}

const RECENT_SEARCHES_KEY = "globalSearch_recentSearches";
const LAST_SEARCH_RESULTS_KEY = "globalSearch_lastResults";
const MAX_RECENT_SEARCHES = 5;

// Helper function to highlight search terms
const highlightText = (text: string, searchTerm: string): React.ReactNode => {
    if (!searchTerm || !text) return text;

    const parts = text.split(new RegExp(`(${searchTerm})`, "gi"));
    return parts.map((part, index) =>
        part.toLowerCase() === searchTerm.toLowerCase() ? (
            <mark
                key={index}
                style={{
                    backgroundColor: "rgba(255, 255, 0, 0.3)",
                    padding: 0,
                }}
            >
                {part}
            </mark>
        ) : (
            part
        )
    );
};

// Helper function to get recent searches from localStorage
const getRecentSearches = (): string[] => {
    if (typeof window === "undefined") return [];
    try {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

// Helper function to save recent search to localStorage
const saveRecentSearch = (searchTerm: string): void => {
    if (typeof window === "undefined" || !searchTerm.trim()) return;
    try {
        const recent = getRecentSearches();
        const filtered = recent.filter(
            (s) => s.toLowerCase() !== searchTerm.toLowerCase()
        );
        const updated = [searchTerm, ...filtered].slice(0, MAX_RECENT_SEARCHES);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
        // Ignore localStorage errors
    }
};

// Helper function to clear recent searches
const clearRecentSearches = (): void => {
    if (typeof window === "undefined") return;
    try {
        localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
        // Ignore localStorage errors
    }
};

// Helper function to get last search results from localStorage
const getLastSearchResults = (): GlobalSearchResult[] => {
    if (typeof window === "undefined") return [];
    try {
        const stored = localStorage.getItem(LAST_SEARCH_RESULTS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

// Helper function to save last search results to localStorage
const saveLastSearchResults = (results: GlobalSearchResult[]): void => {
    if (typeof window === "undefined" || !results || results.length === 0)
        return;
    try {
        localStorage.setItem(LAST_SEARCH_RESULTS_KEY, JSON.stringify(results));
    } catch {
        // Ignore localStorage errors
    }
};

// Function to fetch last 5 created customers
const fetchLastCreatedCustomers = async (): Promise<GlobalSearchResult[]> => {
    try {
        const response = await api.get("/entities/customers", {
            params: {
                page: 1,
                limit: 5,
                sortField: "created_at",
                sortDirection: "desc",
            },
        });

        const customers = response.data?.customers || [];

        // Transform customer data to GlobalSearchResult format
        return customers.map((customer: any) => {
            const name =
                customer.Person?.name || customer.Company?.name || "Unknown";
            return {
                id: customer.id,
                type: "customer" as const,
                name: name,
                subtitle: customer.customer_number || "",
                customerId: customer.id,
                metadata: {
                    type:
                        customer.type ||
                        (customer.Person ? "Person" : "Company"),
                    customer_number: customer.customer_number,
                    collection_status: customer.collection_status,
                },
            };
        });
    } catch (error) {
        console.error("Failed to fetch last created customers:", error);
        return [];
    }
};

const GlobalSearch: React.FC<GlobalSearchProps> = ({
    isHebrewUser = false,
}) => {
    const { t, i18n } = useTranslation([
        "common",
        "customers",
        "contacts",
        "invoices",
        "disputes",
    ]);
    const { data: session } = useSession();
    const theme = useTheme();
    const router = useRouter();
    const pathname = usePathname();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredResult, setHoveredResult] =
        useState<GlobalSearchResult | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [lastSearchResults, setLastSearchResults] = useState<
        GlobalSearchResult[]
    >([]);
    const [isLoadingLastResults, setIsLoadingLastResults] = useState(false);
    const [selectedEntityTypes, setSelectedEntityTypes] = useState<Set<string>>(
        new Set(["customer", "invoice", "contact", "dispute"])
    );
    const [showKeyboardHint, setShowKeyboardHint] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isWidthTransitionComplete, setIsWidthTransitionComplete] =
        useState(true);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const popperRef = useRef<HTMLElement | null>(null);
    const resultRefs = useRef<{ [key: number]: HTMLElement | null }>({});
    const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Load recent searches and last search results on mount
    useEffect(() => {
        setRecentSearches(getRecentSearches());
        const storedResults = getLastSearchResults();
        if (storedResults.length > 0) {
            setLastSearchResults(storedResults);
        }
    }, []);

    // Auto-focus search input on mount
    useEffect(() => {
        // Use a small delay to ensure the input is rendered
        const timer = setTimeout(() => {
            searchInputRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // Auto-focus search input on route change
    useEffect(() => {
        // Use a small delay to ensure the input is rendered after route change
        const timer = setTimeout(() => {
            searchInputRef.current?.focus();
        }, 150);
        return () => clearTimeout(timer);
    }, [pathname]);

    // Debounce search term (reduced to 200ms for faster feedback)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 200);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset filters to all selected if they become empty (safety check)
    useEffect(() => {
        setSelectedEntityTypes((prev) => {
            // If somehow all filters are deselected, reset to all selected
            if (prev.size === 0) {
                return new Set(["customer", "invoice", "contact", "dispute"]);
            }
            return prev;
        });
    }, [debouncedSearch]);

    // Query for search results with request cancellation support
    const { data, isLoading, isError } = useQuery({
        queryKey: ["globalSearch", { query: debouncedSearch }],
        queryFn: searchGlobal,
        enabled: debouncedSearch.trim().length >= 2,
        staleTime: 10000, // Increased cache time
        gcTime: 30000, // Keep in cache for 30 seconds
    });

    const results = useMemo(() => data?.results || [], [data?.results]);
    const countsByType = data?.countsByType;
    const totalCount = data?.totalCount || 0;
    const hasResults = results.length > 0;
    // Don't show recent searches - dropdown only opens when there's at least one character
    const showRecentSearches = false;

    // Filter results by selected entity types
    const filteredResults = useMemo(() => {
        if (selectedEntityTypes.size === 4) return results; // All types selected
        return results.filter((r) => selectedEntityTypes.has(r.type));
    }, [results, selectedEntityTypes]);

    // Group results by entity type
    const groupedResults = useMemo(() => {
        const groups: Record<string, GlobalSearchResult[]> = {
            customer: [],
            invoice: [],
            contact: [],
            dispute: [],
        };
        filteredResults.forEach((result) => {
            if (groups[result.type]) {
                groups[result.type].push(result);
            }
        });
        return groups;
    }, [filteredResults]);

    // Save search results to localStorage when search completes
    useEffect(() => {
        if (hasResults && debouncedSearch.trim().length >= 2) {
            saveLastSearchResults(results);
            setLastSearchResults(results);
            // If we have results and input is focused and there's at least one character, open dropdown after transition completes
            if (
                isFocused &&
                !isOpen &&
                isWidthTransitionComplete &&
                searchTerm.length >= 1
            ) {
                setIsOpen(true);
            }
        }
    }, [
        results,
        hasResults,
        debouncedSearch,
        isFocused,
        isOpen,
        isWidthTransitionComplete,
        searchTerm,
    ]);

    // Fetch last 5 customers when component opens with no search term and no stored results
    useEffect(() => {
        if (
            isOpen &&
            !searchTerm &&
            lastSearchResults.length === 0 &&
            !isLoadingLastResults &&
            !hasResults
        ) {
            setIsLoadingLastResults(true);
            fetchLastCreatedCustomers()
                .then((customers) => {
                    if (customers.length > 0) {
                        // Translate "Unknown" if present in customer names
                        const translatedCustomers = customers.map(
                            (customer) => {
                                if (customer.name === "Unknown") {
                                    return {
                                        ...customer,
                                        name: t("fields.unknown", "Unknown"),
                                    };
                                }
                                return customer;
                            }
                        );
                        setLastSearchResults(translatedCustomers);
                        saveLastSearchResults(translatedCustomers);
                    }
                })
                .catch(() => {
                    // Handle error silently
                })
                .finally(() => {
                    setIsLoadingLastResults(false);
                });
        }
    }, [
        isOpen,
        searchTerm,
        lastSearchResults.length,
        isLoadingLastResults,
        hasResults,
        t,
    ]);

    // Determine which results to display
    const displayResults = useMemo(() => {
        if (searchTerm && hasResults) {
            return filteredResults; // Show current filtered search results
        }
        if (!searchTerm && lastSearchResults.length > 0) {
            return lastSearchResults; // Show last search results or last 5 customers
        }
        return [];
    }, [searchTerm, filteredResults, hasResults, lastSearchResults]);

    // Don't show last results - dropdown only opens when there's at least one character, so we show current search results
    const showLastResults = false;

    // Update preview when selectedIndex changes (keyboard navigation)
    useEffect(() => {
        if (
            selectedIndex >= 0 &&
            displayResults.length > 0 &&
            displayResults[selectedIndex]
        ) {
            setHoveredResult(displayResults[selectedIndex]);
        } else if (selectedIndex < 0) {
            setHoveredResult(null);
        }
    }, [selectedIndex, displayResults]);

    // Keyboard shortcut (Ctrl/Cmd + K)
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "k") {
                event.preventDefault();
                searchInputRef.current?.focus();
                setIsOpen(true);
            }
            // Show keyboard hint on first use
            if (
                event.key === "/" &&
                document.activeElement?.tagName !== "INPUT"
            ) {
                event.preventDefault();
                searchInputRef.current?.focus();
                setIsOpen(true);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Check if keyboard hint should be shown
    useEffect(() => {
        if (isOpen && !searchTerm) {
            const hasSeenHint = localStorage.getItem(
                "globalSearch_keyboardHintSeen"
            );
            if (!hasSeenHint) {
                setShowKeyboardHint(true);
            }
        }
    }, [isOpen, searchTerm]);

    // Toggle entity type filter
    const toggleEntityType = useCallback((type: string) => {
        setSelectedEntityTypes((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(type)) {
                // Prevent deselecting if it's the last remaining type
                if (newSet.size === 1) {
                    return prev; // Don't allow deselecting the last type
                }
                newSet.delete(type);
            } else {
                newSet.add(type);
            }
            return newSet;
        });
    }, []);

    // Scroll selected item into view
    useEffect(() => {
        if (selectedIndex >= 0 && resultRefs.current[selectedIndex]) {
            resultRefs.current[selectedIndex]?.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
            });
        }
    }, [selectedIndex]);

    // Cleanup transition timeout on unmount
    useEffect(() => {
        return () => {
            if (transitionTimeoutRef.current) {
                clearTimeout(transitionTimeoutRef.current);
            }
        };
    }, []);

    // Fix alignment for Hebrew when dropdown opens
    useEffect(() => {
        if (
            isOpen &&
            isWidthTransitionComplete &&
            i18n.language === "he" &&
            searchInputRef.current
        ) {
            const alignDropdown = () => {
                // Find the Autocomplete root element (the input container)
                const autocompleteRoot = searchInputRef.current?.closest(
                    ".MuiAutocomplete-root"
                ) as HTMLElement;

                // Try multiple selectors to find the popper
                const popperSelectors = [
                    ".MuiPopper-root",
                    '[role="presentation"]',
                    ".MuiAutocomplete-popper",
                    "[data-popper-placement]",
                ];

                let popperElement: HTMLElement | null = null;
                for (const selector of popperSelectors) {
                    popperElement = document.querySelector(
                        selector
                    ) as HTMLElement;
                    if (popperElement) break;
                }

                // Also try finding it relative to autocomplete root
                if (!popperElement && autocompleteRoot) {
                    popperElement =
                        autocompleteRoot.parentElement?.querySelector(
                            '.MuiPopper-root, [role="presentation"]'
                        ) as HTMLElement;
                }

                if (autocompleteRoot && popperElement) {
                    const inputRect = autocompleteRoot.getBoundingClientRect();

                    // Find the entire dropdown container (the ul element with both columns)
                    // We align based on the entire container, not just the results column
                    const dropdownContainer = popperElement.querySelector(
                        'ul[role="listbox"], ul'
                    ) as HTMLElement;
                    if (!dropdownContainer) {
                        return; // Wait if container not ready
                    }

                    const dropdownElement = dropdownContainer || popperElement;
                    const dropdownRect =
                        dropdownElement.getBoundingClientRect();

                    // Check if the container width is still transitioning
                    // The expected width when preview is shown is 650px, when not shown is 400px
                    const expectedWidth =
                        hoveredResult && !isMobile ? 650 : 400;
                    const currentWidth = dropdownRect.width;
                    const widthDifference = Math.abs(
                        currentWidth - expectedWidth
                    );

                    // If width is still transitioning (more than 10px difference), skip alignment
                    if (widthDifference > 10) {
                        return;
                    }

                    // Calculate right edge positions
                    // In Hebrew, we want the right edge of the entire dropdown container to align with the right edge of the input
                    const inputRight = inputRect.right;
                    const dropdownRight = dropdownRect.right;

                    // Calculate how much we need to shift the popper to align right edges
                    const offsetX = inputRight - dropdownRight;

                    if (Math.abs(offsetX) > 0.5) {
                        // Get current transform values - handle both translate() and translate3d() formats
                        const currentTransform =
                            popperElement.style.transform || "";

                        // Try translate3d first, then translate
                        let match = currentTransform.match(
                            /translate3d\(([^,]+)px,\s*([^,]+)px/
                        );
                        if (!match) {
                            match = currentTransform.match(
                                /translate\(([^,]+)px,\s*([^,]+)px/
                            );
                        }
                        const currentX = match ? parseFloat(match[1]) : 0;
                        const currentY = match ? parseFloat(match[2]) : 0;

                        // Apply the offset to align right edges
                        const newX = currentX + offsetX;
                        popperElement.style.transform = `translate3d(${newX}px, ${currentY}px, 0)`;
                    }
                }
            };

            // Find the dropdown container and listen for width transition
            const popperElement = document.querySelector(
                '.MuiPopper-root, [role="presentation"]'
            ) as HTMLElement;
            const dropdownContainer = popperElement?.querySelector(
                'ul[role="listbox"], ul'
            ) as HTMLElement;

            if (dropdownContainer) {
                // Listen for transitionend event on width changes
                const handleTransitionEnd = (e: TransitionEvent) => {
                    if (e.propertyName === "width") {
                        alignDropdown();
                    }
                };

                dropdownContainer.addEventListener(
                    "transitionend",
                    handleTransitionEnd
                );

                // Also run immediately and after a short delay as fallback
                alignDropdown();
                const timeout = setTimeout(alignDropdown, 250);

                return () => {
                    dropdownContainer.removeEventListener(
                        "transitionend",
                        handleTransitionEnd
                    );
                    clearTimeout(timeout);
                };
            } else {
                // Fallback: run after delay if container not found
                const timeout = setTimeout(alignDropdown, 250);
                return () => clearTimeout(timeout);
            }
        }
    }, [
        isOpen,
        i18n.language,
        hoveredResult,
        isMobile,
        isWidthTransitionComplete,
    ]);

    // Fix noOptions container alignment for Hebrew
    useEffect(() => {
        if (i18n.language === "he" && isOpen) {
            const applyStyles = () => {
                const noOptionsContainer = document.querySelector(
                    ".MuiAutocomplete-noOptions"
                ) as HTMLElement;
                if (noOptionsContainer) {
                    // Find and style the Popper root element (if it exists)
                    const popperRoot = noOptionsContainer.closest(
                        '[role="presentation"]'
                    ) as HTMLElement;
                    if (popperRoot) {
                        popperRoot.style.direction = "rtl";
                        popperRoot.style.textAlign = "right";
                    }

                    // Find and style the paper parent container
                    const paperContainer = noOptionsContainer.closest(
                        ".MuiAutocomplete-paper"
                    ) as HTMLElement;
                    if (paperContainer) {
                        paperContainer.style.direction = "rtl";
                        paperContainer.style.width = "100%";
                        paperContainer.style.minWidth = "100%";
                        paperContainer.style.maxWidth = "100%";
                        paperContainer.style.textAlign = "right";
                        // Force override any inline styles or computed styles
                        paperContainer.setAttribute("dir", "rtl");
                    }

                    // Apply styles to noOptions container
                    noOptionsContainer.style.direction = "rtl";
                    noOptionsContainer.style.textAlign = "right";
                    noOptionsContainer.style.width = "100%";
                    noOptionsContainer.style.minWidth = "100%";
                    noOptionsContainer.style.maxWidth = "100%";
                    noOptionsContainer.style.boxSizing = "border-box";
                    noOptionsContainer.setAttribute("dir", "rtl");

                    // Also apply styles to the inner Box element (direct child)
                    const innerBox =
                        noOptionsContainer.firstElementChild as HTMLElement;
                    if (innerBox) {
                        innerBox.style.direction = "rtl";
                        innerBox.style.textAlign = "right";
                        innerBox.style.width = "100%";
                        innerBox.style.minWidth = "100%";
                        innerBox.style.maxWidth = "100%";
                        innerBox.style.boxSizing = "border-box";
                        innerBox.setAttribute("dir", "rtl");

                        // Find and style Typography or span element (the text wrapper)
                        const textWrapper = innerBox.querySelector(
                            "span, p, div, .MuiTypography-root"
                        ) as HTMLElement;
                        if (textWrapper) {
                            textWrapper.style.direction = "rtl";
                            textWrapper.style.textAlign = "right";
                            textWrapper.style.width = "100%";
                            textWrapper.style.display = "block";
                            textWrapper.setAttribute("dir", "rtl");
                        }

                        // Also ensure all child elements (not just text nodes) are right-aligned
                        const allChildren = innerBox.querySelectorAll("*");
                        allChildren.forEach((child) => {
                            const el = child as HTMLElement;
                            el.style.textAlign = "right";
                            el.style.direction = "rtl";
                            el.setAttribute("dir", "rtl");
                        });

                        // Also ensure all child text nodes are right-aligned
                        const walker = document.createTreeWalker(
                            innerBox,
                            NodeFilter.SHOW_TEXT,
                            null
                        );
                        let textNode;
                        while ((textNode = walker.nextNode())) {
                            if (textNode.parentElement) {
                                textNode.parentElement.style.textAlign =
                                    "right";
                                textNode.parentElement.style.direction = "rtl";
                                textNode.parentElement.setAttribute(
                                    "dir",
                                    "rtl"
                                );
                            }
                        }
                    }
                }
            };

            // Run immediately and after delays to catch when element appears
            applyStyles();
            const timeout1 = setTimeout(applyStyles, 0);
            const timeout2 = setTimeout(applyStyles, 50);
            const timeout3 = setTimeout(applyStyles, 100);
            const timeout4 = setTimeout(applyStyles, 200);
            const timeout5 = setTimeout(applyStyles, 300);

            // Use MutationObserver to catch when the element is added to DOM
            const observer = new MutationObserver(() => {
                applyStyles();
            });

            const autocompleteRoot = searchInputRef.current?.closest(
                ".MuiAutocomplete-root"
            );
            if (autocompleteRoot) {
                observer.observe(autocompleteRoot, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ["style", "dir"],
                });
            }

            return () => {
                clearTimeout(timeout1);
                clearTimeout(timeout2);
                clearTimeout(timeout3);
                clearTimeout(timeout4);
                clearTimeout(timeout5);
                observer.disconnect();
            };
        }
    }, [isOpen, i18n.language, searchTerm]);

    // Get entity type icon
    const getEntityIcon = useCallback((type: string, metadata?: any) => {
        switch (type) {
            case "customer":
                // Use BusinessIcon for Company type customers, PersonIcon for Person type
                if (metadata?.type === "Company") {
                    return (
                        <BusinessIcon
                            fontSize="small"
                            sx={{ color: "primary.main" }}
                        />
                    );
                }
                return (
                    <PersonIcon
                        fontSize="small"
                        sx={{ color: "primary.main" }}
                    />
                );
            case "invoice":
                return (
                    <DescriptionIcon
                        fontSize="small"
                        sx={{ color: "primary.main" }}
                    />
                );
            case "contact":
                return (
                    <ContactMailIcon
                        fontSize="small"
                        sx={{ color: "primary.main" }}
                    />
                );
            case "dispute":
                return (
                    <GavelIcon
                        fontSize="small"
                        sx={{ color: "primary.main" }}
                    />
                );
            default:
                return (
                    <SearchIcon
                        fontSize="small"
                        sx={{ color: "primary.main" }}
                    />
                );
        }
    }, []);

    // Get entity type label
    const getEntityLabel = useCallback(
        (type: string) => {
            switch (type) {
                case "customer":
                    return t("values.search_entity_type_customer", "Customer");
                case "invoice":
                    return t("values.search_entity_type_invoice", "Invoice");
                case "contact":
                    return t("values.search_entity_type_contact", "Contact");
                case "dispute":
                    return t("values.search_entity_type_dispute", "Dispute");
                default:
                    return type;
            }
        },
        [t]
    );

    // Handle result click
    const handleResultClick = useCallback(
        (result: GlobalSearchResult) => {
            setIsOpen(false);
            setSearchTerm("");
            setSelectedIndex(-1);
            saveRecentSearch(debouncedSearch);

            const locale = i18n.language === "he" ? "he" : "en";

            switch (result.type) {
                case "customer":
                    router.push(
                        `/${locale}${AppUrls.Customer_DETAILS(result.id)}?tab=aggregated_data`
                    );
                    break;
                case "invoice":
                    if (result.customerId) {
                        router.push(
                            `/${locale}${AppUrls.Customer_DETAILS(result.customerId)}?tab=invoices&highlightInvoice=${result.id}`
                        );
                    }
                    break;
                case "contact":
                    if (result.customerId) {
                        router.push(
                            `/${locale}${AppUrls.Customer_DETAILS(result.customerId)}?tab=general&openContact=${result.id}`
                        );
                    }
                    break;
                case "dispute":
                    if (result.customerId) {
                        router.push(
                            `/${locale}${AppUrls.Customer_DETAILS(result.customerId)}?activeTab=outstanding-activities-tab&openDispute=${result.id}`
                        );
                    }
                    break;
            }
        },
        [router, i18n.language, debouncedSearch]
    );

    // Keyboard navigation
    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent) => {
            if (
                !isOpen ||
                (!hasResults && !showRecentSearches && !showLastResults)
            )
                return;

            const totalItems = hasResults
                ? results.length
                : showRecentSearches
                    ? recentSearches.length
                    : displayResults.length;

            switch (event.key) {
                case "ArrowDown":
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedIndex((prev) => {
                        const newIndex =
                            prev < totalItems - 1 ? prev + 1 : prev;
                        return newIndex;
                    });
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedIndex((prev) => {
                        const newIndex = prev > 0 ? prev - 1 : -1;
                        return newIndex;
                    });
                    break;
                case "Enter":
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedIndex((currentIndex) => {
                        if (currentIndex >= 0 && hasResults) {
                            handleResultClick(results[currentIndex]);
                        } else if (currentIndex >= 0 && showRecentSearches) {
                            setSearchTerm(recentSearches[currentIndex]);
                        } else if (
                            currentIndex >= 0 &&
                            showLastResults &&
                            displayResults[currentIndex]
                        ) {
                            handleResultClick(displayResults[currentIndex]);
                        }
                        return -1;
                    });
                    break;
                case "Escape":
                    event.preventDefault();
                    event.stopPropagation();
                    setIsOpen(false);
                    setSelectedIndex(-1);
                    searchInputRef.current?.blur();
                    break;
            }
        },
        [
            isOpen,
            hasResults,
            showRecentSearches,
            showLastResults,
            results,
            recentSearches,
            displayResults,
            handleResultClick,
        ]
    );

    // Handle recent search click
    const handleRecentSearchClick = (search: string) => {
        setSearchTerm(search);
        setIsOpen(true);
        setSelectedIndex(-1);
    };

    // Handle result hover
    const handleResultHover = (
        event: React.MouseEvent<HTMLElement>,
        result: GlobalSearchResult
    ) => {
        setHoveredResult(result);
    };

    // Handle result mouse leave
    const handleResultMouseLeave = () => {
        setHoveredResult(null);
    };

    // Format metadata value for display
    const formatMetadataValue = useCallback(
        (
            key: string,
            value: any,
            metadata?: any,
            recordType?: string
        ): string => {
            if (value === null || value === undefined || value === "")
                return "";
            if (key.includes("date") || key.includes("Date")) {
                return String(value);
            }
            if (key.includes("amount") || key.includes("Amount")) {
                if (typeof value === "number") {
                    // Get currency code from metadata (try currency, currency_code, or default to USD)
                    const currencyCode =
                        metadata?.currency ||
                        metadata?.currency_code ||
                        session?.user?.currency ||
                        "USD";
                    // Use user's locale from session, or fallback to i18n language
                    const userLocale = session?.user?.locale;
                    const userLanguage = session?.user?.language;
                    let locale = "en-US";
                    if (userLocale) {
                        locale = userLocale;
                    } else if (userLanguage === "Hebrew") {
                        locale = "he-IL";
                    } else if (i18n.language === "he") {
                        locale = "he-IL";
                    }
                    return formatCurrencyWithRTLSupport(
                        value,
                        currencyCode,
                        locale,
                        i18n.language
                    );
                }
                return String(value);
            }
            // Translate invoice status
            if (
                recordType === "invoice" &&
                (key === "status" || key === "invoice_status")
            ) {
                const statusKey = `values.invoice_status_${String(value).toLowerCase().replace(/[_\s]/g, "_")}`;
                const translated = t(statusKey, {
                    ns: "invoices",
                    defaultValue: String(value),
                });
                return translated;
            }
            return String(value);
        },
        [i18n.language, session, t]
    );

    // Capitalize first letter of a string
    const capitalizeFirstLetter = useCallback((str: string): string => {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1);
    }, []);

    // Format category value for display
    const formatCategory = useCallback(
        (category: string | null | undefined): string | null => {
            if (!category) return null;
            const categoryKey = `values.category_${category.toLowerCase().replace(/[_\s]/g, "_")}`;
            const translated = t(categoryKey, {
                ns: "customers",
                defaultValue: category,
            });
            return translated;
        },
        [t]
    );

    // Translate metadata field key based on record type
    const translateMetadataField = useCallback(
        (key: string, recordType: string): string => {
            // Map field keys to translation keys based on record type
            const fieldMappings: Record<
                string,
                Record<string, { key: string; ns: string }>
            > = {
                customer: {
                    invoice_number: {
                        key: "fields.invoice_number",
                        ns: "invoices",
                    },
                    amount: { key: "fields.amount", ns: "invoices" },
                    due_date: { key: "fields.due_date", ns: "invoices" },
                    invoice_date: {
                        key: "fields.invoice_date",
                        ns: "invoices",
                    },
                    net_amount: { key: "fields.net_amount", ns: "invoices" },
                    total_paid: { key: "fields.total_paid", ns: "invoices" },
                    email: { key: "fields.email", ns: "contacts" },
                    phone: { key: "fields.phone", ns: "contacts" },
                    mobile: { key: "fields.mobile", ns: "contacts" },
                    first_name: { key: "fields.first_name", ns: "contacts" },
                    last_name: { key: "fields.last_name", ns: "contacts" },
                    address_1: { key: "fields.address_1", ns: "customers" },
                    address_2: { key: "fields.address_2", ns: "customers" },
                    city: { key: "fields.city", ns: "customers" },
                    state: { key: "fields.state", ns: "customers" },
                    postal_code: { key: "fields.postal_code", ns: "customers" },
                    owner: { key: "fields.owner", ns: "customers" },
                    language: { key: "fields.language", ns: "customers" },
                    business_unit: {
                        key: "fields.business_unit",
                        ns: "customers",
                    },
                },
                invoice: {
                    amount: { key: "fields.amount", ns: "invoices" },
                    due_date: { key: "fields.due_date", ns: "invoices" },
                    invoice_date: {
                        key: "fields.invoice_date",
                        ns: "invoices",
                    },
                    net_amount: { key: "fields.net_amount", ns: "invoices" },
                    total_paid: { key: "fields.total_paid", ns: "invoices" },
                    customer_name: { key: "fields.name", ns: "customers" },
                    customer_code: {
                        key: "fields.customer_code",
                        ns: "customers",
                    },
                },
                contact: {
                    email: { key: "fields.email", ns: "contacts" },
                    phone: { key: "fields.phone", ns: "contacts" },
                    mobile: { key: "fields.mobile", ns: "contacts" },
                    first_name: { key: "fields.first_name", ns: "contacts" },
                    last_name: { key: "fields.last_name", ns: "contacts" },
                    role: { key: "fields.role", ns: "contacts" },
                },
                dispute: {
                    dispute_number: {
                        key: "fields.details_dispute_number",
                        ns: "disputes",
                    },
                    dispute_date: {
                        key: "fields.details_dispute_date",
                        ns: "disputes",
                    },
                    dispute_reason: {
                        key: "fields.details_dispute_reason",
                        ns: "disputes",
                    },
                    amount_in_dispute: {
                        key: "fields.details_amount_in_dispute",
                        ns: "disputes",
                    },
                    days_past_due: {
                        key: "fields.details_days_past_due",
                        ns: "disputes",
                    },
                    customer_name: {
                        key: "fields.details_customer",
                        ns: "disputes",
                    },
                    customer_code: {
                        key: "fields.details_customer_code",
                        ns: "disputes",
                    },
                    assigned_user: {
                        key: "fields.assignment_assigned_user",
                        ns: "disputes",
                    },
                },
            };

            const mapping = fieldMappings[recordType]?.[key];
            if (mapping) {
                const translated = t(mapping.key, {
                    ns: mapping.ns,
                    defaultValue: key.replace(/_/g, " "),
                });
                return translated !== mapping.key
                    ? translated
                    : capitalizeFirstLetter(key.replace(/_/g, " "));
            }

            // Fallback: try common fields first
            const commonFields: Record<string, { key: string; ns: string }> = {
                name: { key: "fields.name", ns: "common" },
                status: { key: "fields.status", ns: "common" },
                created_at: { key: "fields.created_at", ns: "common" },
                modified_at: { key: "fields.modified_at", ns: "common" },
            };

            const commonMapping = commonFields[key];
            if (commonMapping) {
                const translated = t(commonMapping.key, {
                    ns: commonMapping.ns,
                    defaultValue: key.replace(/_/g, " "),
                });
                return translated !== commonMapping.key
                    ? translated
                    : capitalizeFirstLetter(key.replace(/_/g, " "));
            }

            // Final fallback: capitalize and replace underscores
            return capitalizeFirstLetter(key.replace(/_/g, " "));
        },
        [t, capitalizeFirstLetter]
    );

    // Custom Popper component for Autocomplete - allows dropdown to extend beyond textbox
    const CustomPopper = useCallback(
        (props: any) => {
            const placement =
                i18n.language === "he" ? "bottom-end" : "bottom-start";

            return (
                <Popper
                    {...props}
                    ref={(node) => {
                        popperRef.current = node;
                        if (typeof props.ref === "function") {
                            props.ref(node);
                        } else if (props.ref) {
                            props.ref.current = node;
                        }
                    }}
                    placement={placement}
                    modifiers={[
                        {
                            name: "offset",
                            options: {
                                offset: [0, 8],
                            },
                        },
                        {
                            name: "preventOverflow",
                            enabled: i18n.language !== "he", // Disable for Hebrew to allow proper right alignment
                            options: {
                                altAxis: true,
                                altBoundary: true,
                                tether: false,
                                rootBoundary: "viewport",
                                padding: 8,
                            },
                        },
                        {
                            name: "flip",
                            enabled: false,
                        },
                        {
                            name: "computeStyles",
                            options: {
                                adaptive: false, // Disable adaptive positioning for consistent alignment
                            },
                        },
                        {
                            name: "custom",
                            enabled: i18n.language === "he",
                            phase: "afterWrite",
                            requires: [
                                "offset",
                                "preventOverflow",
                                "computeStyles",
                            ],
                            fn: ({ state }: any) => {
                                // Fine-tune alignment after offset modifier runs
                                if (
                                    i18n.language === "he" &&
                                    state.elements.reference &&
                                    state.elements.popper
                                ) {
                                    // Use requestAnimationFrame to ensure DOM is fully updated
                                    requestAnimationFrame(() => {
                                        const referenceRect =
                                            state.elements.reference.getBoundingClientRect();
                                        const popperElement = state.elements
                                            .popper as HTMLElement;
                                        const dropdownContainer =
                                            popperElement?.querySelector(
                                                'ul[role="listbox"], ul'
                                            ) as HTMLElement;

                                        if (!dropdownContainer) return;

                                        const dropdownRect =
                                            dropdownContainer.getBoundingClientRect();
                                        const expectedWidth =
                                            hoveredResult && !isMobile
                                                ? 650
                                                : 400;
                                        const currentWidth = dropdownRect.width;
                                        const widthDifference = Math.abs(
                                            currentWidth - expectedWidth
                                        );

                                        // If width is still transitioning, skip alignment to prevent flicker
                                        if (widthDifference > 10) {
                                            return;
                                        }

                                        const inputRight = referenceRect.right;
                                        const dropdownRight =
                                            dropdownRect.right;
                                        const offsetX =
                                            inputRight - dropdownRight;

                                        if (Math.abs(offsetX) > 0.5) {
                                            // Get current position from Popper's transform
                                            const currentTransform =
                                                popperElement.style.transform ||
                                                "";
                                            let match = currentTransform.match(
                                                /translate3d\(([^,]+)px,\s*([^,]+)px/
                                            );
                                            if (!match) {
                                                match = currentTransform.match(
                                                    /translate\(([^,]+)px,\s*([^,]+)px/
                                                );
                                            }
                                            const currentX = match
                                                ? parseFloat(match[1])
                                                : 0;
                                            const currentY = match
                                                ? parseFloat(match[2])
                                                : 8;

                                            const newX = currentX + offsetX;

                                            // Apply the transform directly to the element
                                            popperElement.style.transform = `translate3d(${newX}px, ${currentY}px, 0)`;
                                        }
                                    });
                                }
                            },
                        },
                    ]}
                    sx={{
                        zIndex: 1300,
                        ...(i18n.language === "he" && {
                            direction: "rtl",
                            textAlign: "right",
                        }),
                        "& .MuiAutocomplete-paper": {
                            minWidth: "max-content",
                            width: "max-content",
                            margin: 0,
                            marginTop: "8px",
                            padding: 0,
                            ...(i18n.language === "he" && {
                                "&:has(.MuiAutocomplete-noOptions)": {
                                    width: "100%",
                                    minWidth: "100%",
                                    maxWidth: "100%",
                                    direction: "rtl",
                                    textAlign: "right",
                                },
                            }),
                        },
                        "& .MuiAutocomplete-listbox": {
                            padding: 0,
                        },
                        ...(i18n.language === "he" && {
                            "& .MuiAutocomplete-paper .MuiAutocomplete-noOptions":
                            {
                                width: "100% !important",
                                minWidth: "100% !important",
                                maxWidth: "100% !important",
                                direction: "rtl !important",
                                textAlign: "right !important",
                            },
                        }),
                    }}
                />
            );
        },
        [i18n.language, hoveredResult, isMobile]
    );

    // Render result count header
    const renderResultCountHeader = () => {
        if (!searchTerm || !hasResults) return null;

        return (
            <ListSubheader
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                    flexDirection:
                        i18n.language === "he" ? "row-reverse" : "row",
                    py: 1,
                    px: 2,
                    backgroundColor: theme.palette.background.default,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                }}
            >
                <Typography
                    variant="caption"
                    fontWeight="medium"
                    sx={{
                        color: "text.secondary",
                        textAlign: i18n.language === "he" ? "right" : "left",
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                        whiteSpace: "nowrap",
                    }}
                >
                    {t("fields.results", "Results")}: {filteredResults.length}
                    {totalCount > filteredResults.length && `/${totalCount}`}
                </Typography>
                {countsByType && (
                    <Box
                        sx={{
                            display: "flex",
                            gap: 0.5,
                            flexDirection:
                                i18n.language === "he" ? "row-reverse" : "row",
                        }}
                    >
                        {Object.entries(countsByType).map(([type, count]) => {
                            if (count === 0) return null;
                            const isSelected = selectedEntityTypes.has(type);
                            const allSelected = selectedEntityTypes.size === 4;
                            return (
                                <Chip
                                    key={type}
                                    label={`${getEntityLabel(type)}: ${count}`}
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleEntityType(type);
                                    }}
                                    sx={{
                                        height: 20,
                                        fontSize: "0.65rem",
                                        backgroundColor: isSelected
                                            ? allSelected
                                                ? alpha(
                                                    theme.palette.primary
                                                        .main,
                                                    0.25
                                                )
                                                : alpha(
                                                    theme.palette.primary
                                                        .main,
                                                    0.2
                                                )
                                            : alpha(
                                                theme.palette.primary.main,
                                                0.08
                                            ),
                                        color: isSelected
                                            ? theme.palette.primary.main
                                            : theme.palette.text.secondary,
                                        border: isSelected
                                            ? `1px solid ${theme.palette.primary.main}`
                                            : `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                                        cursor: "pointer",
                                        opacity: isSelected ? 1 : 0.7,
                                        "&:hover": {
                                            backgroundColor: isSelected
                                                ? allSelected
                                                    ? alpha(
                                                        theme.palette.primary
                                                            .main,
                                                        0.35
                                                    )
                                                    : alpha(
                                                        theme.palette.primary
                                                            .main,
                                                        0.3
                                                    )
                                                : alpha(
                                                    theme.palette.primary
                                                        .main,
                                                    0.15
                                                ),
                                            opacity: 1,
                                        },
                                    }}
                                />
                            );
                        })}
                    </Box>
                )}
            </ListSubheader>
        );
    };

    // Render a single result option (helper for grouped results)
    const renderResultOption = (
        option: GlobalSearchResult,
        index: number,
        _props: any
    ) => {
        const isSelected = selectedIndex === index;

        return (
            <Box
                key={`${option.type}-${option.id}`}
                component="li"
                onMouseEnter={(e) => {
                    handleResultHover(e, option);
                    setSelectedIndex(index);
                }}
                onMouseLeave={handleResultMouseLeave}
                onClick={() => handleResultClick(option)}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    py: 1.5,
                    px: 2,
                    cursor: "pointer",
                    backgroundColor: isSelected
                        ? theme.palette.action.selected
                        : "transparent",
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                    "&:hover": {
                        backgroundColor: theme.palette.action.hover,
                    },
                }}
                ref={(el) => {
                    if (el) {
                        resultRefs.current[index] = el as HTMLElement;
                    }
                }}
                role="option"
                aria-selected={isSelected}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "primary.main",
                    }}
                >
                    {getEntityIcon(option.type, option.metadata)}
                </Box>
                <Box
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 0.5,
                            flexDirection:
                                i18n.language === "he" ? "row-reverse" : "row",
                        }}
                    >
                        <Typography
                            variant="body2"
                            fontWeight="medium"
                            noWrap
                            sx={{
                                flex: 1,
                                minWidth: 0,
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {highlightText(
                                option.name,
                                searchTerm || debouncedSearch
                            )}
                        </Typography>
                        <Chip
                            label={getEntityLabel(option.type)}
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleEntityType(option.type);
                            }}
                            sx={{
                                height: 20,
                                fontSize: "0.65rem",
                                backgroundColor: (() => {
                                    const isSelected = selectedEntityTypes.has(
                                        option.type
                                    );
                                    const allSelected =
                                        selectedEntityTypes.size === 4;
                                    return isSelected
                                        ? allSelected
                                            ? alpha(
                                                theme.palette.primary.main,
                                                0.25
                                            )
                                            : alpha(
                                                theme.palette.primary.main,
                                                0.2
                                            )
                                        : alpha(
                                            theme.palette.primary.main,
                                            0.08
                                        );
                                })(),
                                color: selectedEntityTypes.has(option.type)
                                    ? theme.palette.primary.main
                                    : theme.palette.text.secondary,
                                fontWeight: 500,
                                border: selectedEntityTypes.has(option.type)
                                    ? `1px solid ${theme.palette.primary.main}`
                                    : `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                                cursor: "pointer",
                                opacity: selectedEntityTypes.has(option.type)
                                    ? 1
                                    : 0.7,
                                "& .MuiChip-label": {
                                    padding: "0 6px",
                                },
                                order: isHebrewUser ? -1 : 1,
                                flexShrink: 0,
                                "&:hover": {
                                    backgroundColor: (() => {
                                        const isSelected =
                                            selectedEntityTypes.has(
                                                option.type
                                            );
                                        const allSelected =
                                            selectedEntityTypes.size === 4;
                                        return isSelected
                                            ? allSelected
                                                ? alpha(
                                                    theme.palette.primary
                                                        .main,
                                                    0.35
                                                )
                                                : alpha(
                                                    theme.palette.primary
                                                        .main,
                                                    0.3
                                                )
                                            : alpha(
                                                theme.palette.primary.main,
                                                0.15
                                            );
                                    })(),
                                    opacity: 1,
                                },
                            }}
                        />
                    </Box>
                    {option.subtitle && (
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            sx={{
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {highlightText(
                                option.subtitle,
                                searchTerm || debouncedSearch
                            )}
                        </Typography>
                    )}
                </Box>
            </Box>
        );
    };

    // Render keyboard shortcut hint
    const renderKeyboardHint = () => {
        if (!showKeyboardHint || searchTerm) return null;

        return (
            <Box
                sx={{
                    p: 2,
                    backgroundColor: alpha(theme.palette.info.main, 0.1),
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexDirection:
                            i18n.language === "he" ? "row-reverse" : "row",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            flexDirection:
                                i18n.language === "he" ? "row-reverse" : "row",
                        }}
                    >
                        <KeyboardIcon fontSize="small" color="primary" />
                        <Typography variant="caption" color="text.secondary">
                            {t(
                                "fields.search_keyboard_hint",
                                "Press Ctrl+K or / to search"
                            )}
                        </Typography>
                    </Box>
                    <CloseIcon
                        fontSize="small"
                        sx={{
                            cursor: "pointer",
                            color: "text.secondary",
                            "&:hover": { color: "text.primary" },
                        }}
                        onClick={() => {
                            setShowKeyboardHint(false);
                            localStorage.setItem(
                                "globalSearch_keyboardHintSeen",
                                "true"
                            );
                        }}
                    />
                </Box>
            </Box>
        );
    };

    // Render recent searches
    const renderRecentSearches = () => {
        if (!showRecentSearches) return null;

        return (
            <>
                <ListSubheader
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                        flexDirection:
                            i18n.language === "he" ? "row-reverse" : "row",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            color: "primary.main",
                            flexDirection:
                                i18n.language === "he" ? "row-reverse" : "row",
                        }}
                    >
                        <HistoryIcon fontSize="small" />
                        <Typography
                            variant="caption"
                            fontWeight="bold"
                            sx={{
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {t(
                                "fields.search_recent_searches",
                                "Recent Searches"
                            )}
                        </Typography>
                    </Box>
                    <Typography
                        variant="caption"
                        sx={{
                            cursor: "pointer",
                            color: "primary.main",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            clearRecentSearches();
                            setRecentSearches([]);
                        }}
                    >
                        {t("actions.search_clear", "Clear")}
                    </Typography>
                </ListSubheader>
                {recentSearches.map((search, index) => (
                    <Box
                        key={index}
                        component="li"
                        onClick={() => handleRecentSearchClick(search)}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            py: 1.5,
                            px: 2,
                            cursor: "pointer",
                            backgroundColor:
                                selectedIndex === index
                                    ? theme.palette.action.selected
                                    : "transparent",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            flexDirection:
                                i18n.language === "he" ? "row-reverse" : "row",
                            "&:hover": {
                                backgroundColor: theme.palette.action.hover,
                            },
                        }}
                    >
                        <SearchIcon
                            fontSize="small"
                            sx={{ color: "primary.main" }}
                        />
                        <Typography
                            variant="body2"
                            sx={{
                                flex: 1,
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {search}
                        </Typography>
                        <ArrowRightIcon
                            fontSize="small"
                            sx={{
                                color: "primary.main",
                                transform:
                                    i18n.language === "he"
                                        ? "scaleX(-1)"
                                        : "none",
                            }}
                        />
                    </Box>
                ))}
            </>
        );
    };

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                margin: 0,
                padding: 0,
                position: "relative",
            }}
        >
            <Autocomplete
                open={
                    isOpen &&
                    isWidthTransitionComplete &&
                    searchTerm.length >= 1
                }
                onOpen={() => {
                    // Only open if there's at least one character typed
                    if (searchTerm.length < 1) {
                        return;
                    }
                    setIsFocused(true);
                    // If width transition is in progress, wait for it to complete
                    if (!isWidthTransitionComplete) {
                        if (transitionTimeoutRef.current) {
                            clearTimeout(transitionTimeoutRef.current);
                        }
                        transitionTimeoutRef.current = setTimeout(() => {
                            setIsWidthTransitionComplete(true);
                            setIsOpen(true);
                        }, 250); // Wait 250ms for 0.2s transition + buffer
                    } else {
                        setIsOpen(true);
                    }
                }}
                onClose={() => {
                    if (transitionTimeoutRef.current) {
                        clearTimeout(transitionTimeoutRef.current);
                    }
                    setIsOpen(false);
                    setHoveredResult(null);
                    setSelectedIndex(-1);
                    setIsWidthTransitionComplete(true);
                    // Shrink if no text when closing
                    if (!searchTerm) {
                        setIsFocused(false);
                    }
                }}
                options={displayResults}
                getOptionLabel={(option) => option.name}
                loading={isLoading}
                inputValue={searchTerm}
                onInputChange={(_, newValue) => {
                    setSearchTerm(newValue);
                    setSelectedIndex(-1);
                    // Keep expanded if there's text
                    if (newValue) {
                        setIsFocused(true);
                        // If input is expanding, wait for transition before showing results
                        if (!isWidthTransitionComplete) {
                            if (transitionTimeoutRef.current) {
                                clearTimeout(transitionTimeoutRef.current);
                            }
                            transitionTimeoutRef.current = setTimeout(() => {
                                setIsWidthTransitionComplete(true);
                            }, 250);
                        }
                    }
                }}
                onChange={(_, newValue) => {
                    if (newValue) {
                        handleResultClick(newValue);
                    }
                }}
                filterOptions={(x) => x} // Disable client-side filtering
                disableListWrap
                data-rtl={i18n.language === "he"}
                size="small"
                sx={{
                    width: {
                        xs: "100%",
                        sm: isFocused || searchTerm ? "300px" : "200px",
                        md: isFocused || searchTerm ? "400px" : "250px",
                    },
                    transition: "width 0.2s ease-in-out",
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                    margin: 0,
                    padding: 0,
                    "& .MuiAutocomplete-root": {
                        margin: 0,
                        padding: 0,
                    },
                    "& .MuiFormControl-root": {
                        margin: 0,
                        padding: 0,
                        height: theme.appButton.sizeSmall.height,
                    },
                    "& .MuiOutlinedInput-root.MuiInputBase-root.MuiInputBase-sizeSmall":
                    {
                        height: `${theme.appButton.sizeSmall.height}px !important`,
                        minHeight: `${theme.appButton.sizeSmall.height}px !important`,
                        maxHeight: `${theme.appButton.sizeSmall.height}px !important`,
                        boxSizing: "border-box",
                        borderRadius: theme.spacing(3),
                        backgroundColor: "rgba(255, 255, 255, 0.1) !important",
                        color: "white",
                        // Add padding between border and magnifying glass
                        // For LTR: icon is at positionStart (left), add marginLeft
                        // For RTL: icon is at positionEnd (right), add marginRight
                        "& .MuiInputAdornment-positionStart": {
                            marginLeft:
                                i18n.language === "he"
                                    ? 0
                                    : `${theme.spacing(1.5)} !important`,
                            marginRight: i18n.language === "he" ? 0 : 0,
                        },
                        "& .MuiInputAdornment-positionEnd": {
                            marginLeft: i18n.language === "he" ? 0 : 0,
                            marginRight:
                                i18n.language === "he"
                                    ? `${theme.spacing(1.5)} !important`
                                    : 0,
                        },
                        "& input": {
                            color: "white",
                            paddingTop: 0,
                            paddingBottom: 0,
                            height: "100%",
                            boxSizing: "border-box",
                        },
                        "& fieldset": {
                            borderRadius: `${theme.spacing(3)} !important`,
                            borderColor: "rgba(255, 255, 255, 0.3)",
                        },
                        "&:hover fieldset": {
                            borderColor: "rgba(255, 255, 255, 0.5)",
                        },
                        "&.Mui-focused fieldset": {
                            borderColor: "rgba(255, 255, 255, 0.7)",
                        },
                        "& input::placeholder": {
                            color: "rgba(255, 255, 255, 0.7)",
                            opacity: 1,
                        },
                    },
                    "& .MuiAutocomplete-paper": {
                        minWidth: "max-content",
                        width: "max-content",
                        ...(i18n.language === "he" && {
                            "&:has(.MuiAutocomplete-noOptions)": {
                                width: "100%",
                                minWidth: "100%",
                                maxWidth: "100%",
                                direction: "rtl",
                            },
                        }),
                    },
                    "& .MuiAutocomplete-noOptions": {
                        direction:
                            `${i18n.language === "he" ? "rtl" : "ltr"} !important` as any,
                        textAlign:
                            `${i18n.language === "he" ? "right" : "left"} !important` as any,
                        width:
                            i18n.language === "he"
                                ? "100% !important"
                                : undefined,
                        minWidth:
                            i18n.language === "he"
                                ? "100% !important"
                                : undefined,
                        maxWidth:
                            i18n.language === "he"
                                ? "100% !important"
                                : undefined,
                    },
                }}
                ListboxComponent={(props) => (
                    <Box
                        component="ul"
                        {...(props as any)}
                        sx={{
                            position: "relative",
                            display: "flex",
                            flexDirection: "row",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            maxHeight: "400px",
                            width:
                                hoveredResult && !isMobile ? "650px" : "400px", // Expand when preview is shown
                            margin: 0,
                            padding: 0,
                            transition: "width 0.2s ease-in-out",
                        }}
                    >
                        {/* Results Column */}
                        <Box
                            component="div"
                            sx={{
                                width: "400px",
                                flexShrink: 0,
                                overflowY: "auto",
                                margin: 0,
                                padding: 0,
                                position: "relative",
                                order: i18n.language === "he" ? 1 : 1, // Results: order 1 (appears on right in RTL)
                            }}
                        >
                            {renderKeyboardHint()}
                            {showRecentSearches && renderRecentSearches()}
                            {showRecentSearches && hasResults && <Divider />}
                            {searchTerm &&
                                hasResults &&
                                renderResultCountHeader()}
                            {searchTerm &&
                                hasResults &&
                                filteredResults.length > 0 && (
                                    // Render grouped results
                                    <>
                                        {groupedResults.customer.length > 0 && (
                                            <>
                                                <ListSubheader
                                                    sx={{
                                                        direction:
                                                            i18n.language ===
                                                                "he"
                                                                ? "rtl"
                                                                : "ltr",
                                                        flexDirection:
                                                            i18n.language ===
                                                                "he"
                                                                ? "row-reverse"
                                                                : "row",
                                                        backgroundColor:
                                                            theme.palette
                                                                .background
                                                                .default,
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 1,
                                                            color: "primary.main",
                                                            flexDirection:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "row-reverse"
                                                                    : "row",
                                                        }}
                                                    >
                                                        {getEntityIcon(
                                                            "customer",
                                                            {}
                                                        )}
                                                        <Typography
                                                            variant="caption"
                                                            fontWeight="bold"
                                                        >
                                                            {getEntityLabel(
                                                                "customer"
                                                            )}{" "}
                                                            (
                                                            {
                                                                groupedResults
                                                                    .customer
                                                                    .length
                                                            }
                                                            )
                                                        </Typography>
                                                    </Box>
                                                </ListSubheader>
                                                {groupedResults.customer.map(
                                                    (result) => {
                                                        const globalIndex =
                                                            filteredResults.indexOf(
                                                                result
                                                            );
                                                        return renderResultOption(
                                                            result,
                                                            globalIndex,
                                                            {}
                                                        );
                                                    }
                                                )}
                                            </>
                                        )}
                                        {groupedResults.invoice.length > 0 && (
                                            <>
                                                <ListSubheader
                                                    sx={{
                                                        direction:
                                                            i18n.language ===
                                                                "he"
                                                                ? "rtl"
                                                                : "ltr",
                                                        flexDirection:
                                                            i18n.language ===
                                                                "he"
                                                                ? "row-reverse"
                                                                : "row",
                                                        backgroundColor:
                                                            theme.palette
                                                                .background
                                                                .default,
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 1,
                                                            color: "primary.main",
                                                            flexDirection:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "row-reverse"
                                                                    : "row",
                                                        }}
                                                    >
                                                        {getEntityIcon(
                                                            "invoice",
                                                            {}
                                                        )}
                                                        <Typography
                                                            variant="caption"
                                                            fontWeight="bold"
                                                        >
                                                            {getEntityLabel(
                                                                "invoice"
                                                            )}{" "}
                                                            (
                                                            {
                                                                groupedResults
                                                                    .invoice
                                                                    .length
                                                            }
                                                            )
                                                        </Typography>
                                                    </Box>
                                                </ListSubheader>
                                                {groupedResults.invoice.map(
                                                    (result) => {
                                                        const globalIndex =
                                                            filteredResults.indexOf(
                                                                result
                                                            );
                                                        return renderResultOption(
                                                            result,
                                                            globalIndex,
                                                            {}
                                                        );
                                                    }
                                                )}
                                            </>
                                        )}
                                        {groupedResults.contact.length > 0 && (
                                            <>
                                                <ListSubheader
                                                    sx={{
                                                        direction:
                                                            i18n.language ===
                                                                "he"
                                                                ? "rtl"
                                                                : "ltr",
                                                        flexDirection:
                                                            i18n.language ===
                                                                "he"
                                                                ? "row-reverse"
                                                                : "row",
                                                        backgroundColor:
                                                            theme.palette
                                                                .background
                                                                .default,
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 1,
                                                            color: "primary.main",
                                                            flexDirection:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "row-reverse"
                                                                    : "row",
                                                        }}
                                                    >
                                                        {getEntityIcon(
                                                            "contact",
                                                            {}
                                                        )}
                                                        <Typography
                                                            variant="caption"
                                                            fontWeight="bold"
                                                        >
                                                            {getEntityLabel(
                                                                "contact"
                                                            )}{" "}
                                                            (
                                                            {
                                                                groupedResults
                                                                    .contact
                                                                    .length
                                                            }
                                                            )
                                                        </Typography>
                                                    </Box>
                                                </ListSubheader>
                                                {groupedResults.contact.map(
                                                    (result) => {
                                                        const globalIndex =
                                                            filteredResults.indexOf(
                                                                result
                                                            );
                                                        return renderResultOption(
                                                            result,
                                                            globalIndex,
                                                            {}
                                                        );
                                                    }
                                                )}
                                            </>
                                        )}
                                        {groupedResults.dispute.length > 0 && (
                                            <>
                                                <ListSubheader
                                                    sx={{
                                                        direction:
                                                            i18n.language ===
                                                                "he"
                                                                ? "rtl"
                                                                : "ltr",
                                                        flexDirection:
                                                            i18n.language ===
                                                                "he"
                                                                ? "row-reverse"
                                                                : "row",
                                                        backgroundColor:
                                                            theme.palette
                                                                .background
                                                                .default,
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 1,
                                                            color: "primary.main",
                                                            flexDirection:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "row-reverse"
                                                                    : "row",
                                                        }}
                                                    >
                                                        {getEntityIcon(
                                                            "dispute",
                                                            {}
                                                        )}
                                                        <Typography
                                                            variant="caption"
                                                            fontWeight="bold"
                                                        >
                                                            {getEntityLabel(
                                                                "dispute"
                                                            )}{" "}
                                                            (
                                                            {
                                                                groupedResults
                                                                    .dispute
                                                                    .length
                                                            }
                                                            )
                                                        </Typography>
                                                    </Box>
                                                </ListSubheader>
                                                {groupedResults.dispute.map(
                                                    (result) => {
                                                        const globalIndex =
                                                            filteredResults.indexOf(
                                                                result
                                                            );
                                                        return renderResultOption(
                                                            result,
                                                            globalIndex,
                                                            {}
                                                        );
                                                    }
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            {searchTerm &&
                                hasResults &&
                                filteredResults.length === 0 && (
                                    <Box
                                        sx={{
                                            p: 3,
                                            textAlign: "center",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{
                                                mb: 1,
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                            }}
                                        >
                                            {t(
                                                "messages.no_results_match_filters",
                                                "No results match your selected filters"
                                            )}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                            }}
                                        >
                                            {t(
                                                "messages.click_filters_to_enable",
                                                "Click the filter chips above to enable more result types"
                                            )}
                                        </Typography>
                                    </Box>
                                )}
                        </Box>
                        {/* Preview Column */}
                        {hoveredResult && !isMobile && (
                            <Box
                                component="div"
                                sx={{
                                    width: "250px",
                                    flexShrink: 0,
                                    order: i18n.language === "he" ? 2 : 2, // Preview: order 2 (appears on left in RTL)
                                    borderLeft:
                                        i18n.language === "he"
                                            ? "none"
                                            : `1px solid ${theme.palette.divider}`,
                                    borderRight:
                                        i18n.language === "he"
                                            ? `1px solid ${theme.palette.divider}`
                                            : "none",
                                    backgroundColor:
                                        theme.palette.background.paper,
                                    overflowY: "auto",
                                    maxHeight: "400px",
                                    p: 2,
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        mb: 1,
                                        color: "primary.main",
                                        flexDirection:
                                            i18n.language === "he"
                                                ? "row-reverse"
                                                : "row",
                                        width: "100%",
                                    }}
                                >
                                    <Typography
                                        variant="body1"
                                        fontWeight="bold"
                                        sx={{
                                            fontSize: "1.1rem",
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            flex: 1,
                                            width: "100%",
                                        }}
                                    >
                                        {highlightText(
                                            hoveredResult.name,
                                            searchTerm || debouncedSearch
                                        )}
                                    </Typography>
                                </Box>
                                {/* Show customer code at the top for customers */}
                                {hoveredResult.type === "customer" &&
                                    hoveredResult.metadata?.customer_number && (
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                display: "block",
                                                mb: 1,
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            <strong>
                                                {t("fields.customer_code", {
                                                    ns: "customers",
                                                    defaultValue:
                                                        "Customer Code",
                                                })}
                                                :
                                            </strong>{" "}
                                            {highlightText(
                                                String(
                                                    hoveredResult.metadata
                                                        .customer_number
                                                ),
                                                searchTerm || debouncedSearch
                                            )}
                                        </Typography>
                                    )}
                                {/* Show parent customer for customers */}
                                {hoveredResult.type === "customer" &&
                                    hoveredResult.metadata
                                        ?.parent_customer_name && (
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                display: "block",
                                                mb: 1,
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            <strong>
                                                {t("fields.parent_customer", {
                                                    ns: "customers",
                                                    defaultValue:
                                                        "Parent Customer",
                                                })}
                                                :
                                            </strong>{" "}
                                            {highlightText(
                                                hoveredResult.metadata
                                                    .parent_customer_name,
                                                searchTerm || debouncedSearch
                                            )}
                                        </Typography>
                                    )}
                                {/* Show category for customers */}
                                {hoveredResult.type === "customer" &&
                                    formatCategory(
                                        hoveredResult.metadata?.current_category
                                    ) && (
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                display: "block",
                                                mb: 1,
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            <strong>
                                                {t("fields.category", {
                                                    ns: "customers",
                                                    defaultValue: "Category",
                                                })}
                                                :
                                            </strong>{" "}
                                            {formatCategory(
                                                hoveredResult.metadata
                                                    ?.current_category
                                            )}
                                        </Typography>
                                    )}
                                {/* Show company name at the top for contacts */}
                                {hoveredResult.type === "contact" &&
                                    hoveredResult.metadata?.company_name && (
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                display: "block",
                                                mb: 1,
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            <strong>
                                                {t("fields.company_name", {
                                                    ns: "contacts",
                                                    defaultValue:
                                                        "Company Name",
                                                })}
                                                :
                                            </strong>{" "}
                                            {highlightText(
                                                hoveredResult.metadata
                                                    .company_name,
                                                searchTerm || debouncedSearch
                                            )}
                                        </Typography>
                                    )}
                                {hoveredResult.subtitle &&
                                    hoveredResult.type !== "contact" &&
                                    hoveredResult.type !== "customer" && (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                                display: "block",
                                                mb: 1,
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            {hoveredResult.subtitle}
                                        </Typography>
                                    )}
                                {/* Show status and total overdue amount for customers */}
                                {hoveredResult.type === "customer" &&
                                    hoveredResult.metadata && (
                                        <Box sx={{ mt: 1, mb: 1 }}>
                                            {hoveredResult.metadata
                                                .collection_status && (
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            display: "block",
                                                            mb: 0.5,
                                                            textAlign:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "right"
                                                                    : "left",
                                                            direction:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                        }}
                                                    >
                                                        <strong>
                                                            {t("fields.status", {
                                                                ns: "common",
                                                                defaultValue:
                                                                    "Status",
                                                            })}
                                                            :
                                                        </strong>{" "}
                                                        {highlightText(
                                                            capitalizeFirstLetter(
                                                                String(
                                                                    hoveredResult
                                                                        .metadata
                                                                        .collection_status
                                                                )
                                                            ),
                                                            searchTerm ||
                                                            debouncedSearch
                                                        )}
                                                    </Typography>
                                                )}
                                            {hoveredResult.metadata
                                                .total_invoices_overdue_formatted && (
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            display: "block",
                                                            mb: 0.5,
                                                            textAlign:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "right"
                                                                    : "left",
                                                            direction:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                        }}
                                                    >
                                                        <strong>
                                                            {t(
                                                                "fields.total_outstanding_amount",
                                                                {
                                                                    ns: "customers",
                                                                    defaultValue:
                                                                        "Total Overdue Amount",
                                                                }
                                                            )}
                                                            :
                                                        </strong>{" "}
                                                        {(() => {
                                                            // If it's already a formatted string, use it; otherwise format it
                                                            const value =
                                                                hoveredResult
                                                                    .metadata
                                                                    .total_invoices_overdue;
                                                            if (
                                                                typeof value ===
                                                                "number"
                                                            ) {
                                                                const currencyCode =
                                                                    hoveredResult
                                                                        .metadata
                                                                        ?.currency ||
                                                                    hoveredResult
                                                                        .metadata
                                                                        ?.currency_code ||
                                                                    session?.user
                                                                        ?.currency ||
                                                                    "USD";
                                                                // Use user's locale from session, or fallback to i18n language
                                                                const userLocale =
                                                                    session?.user
                                                                        ?.locale;
                                                                const userLanguage =
                                                                    session?.user
                                                                        ?.language;
                                                                let locale =
                                                                    "en-US";
                                                                if (userLocale) {
                                                                    locale =
                                                                        userLocale;
                                                                } else if (
                                                                    userLanguage ===
                                                                    "Hebrew"
                                                                ) {
                                                                    locale =
                                                                        "he-IL";
                                                                } else if (
                                                                    i18n.language ===
                                                                    "he"
                                                                ) {
                                                                    locale =
                                                                        "he-IL";
                                                                }
                                                                return formatCurrencyWithRTLSupport(
                                                                    value,
                                                                    currencyCode,
                                                                    locale,
                                                                    i18n.language
                                                                );
                                                            }
                                                            return hoveredResult
                                                                .metadata
                                                                .total_invoices_overdue_formatted;
                                                        })()}
                                                    </Typography>
                                                )}
                                        </Box>
                                    )}
                                {hoveredResult.metadata && (
                                    <Box sx={{ mt: 1 }}>
                                        {Object.entries(hoveredResult.metadata)
                                            .filter(([key, value]) => {
                                                const formatted =
                                                    formatMetadataValue(
                                                        key,
                                                        value,
                                                        hoveredResult.metadata,
                                                        hoveredResult.type
                                                    );
                                                const excludedKeys = [
                                                    "type",
                                                    "customer_number",
                                                    "invoice_number",
                                                    "dispute_id",
                                                    "collection_status",
                                                    "total_invoices_overdue",
                                                    "total_invoices_overdue_formatted",
                                                    "company_name",
                                                    "parent_customer_name",
                                                    "current_category",
                                                ];
                                                // Exclude amount_formatted for invoices
                                                if (
                                                    hoveredResult.type ===
                                                    "invoice" &&
                                                    key === "amount_formatted"
                                                ) {
                                                    return false;
                                                }
                                                return (
                                                    formatted &&
                                                    !excludedKeys.includes(key)
                                                );
                                            })
                                            .slice(0, 5)
                                            .map(([key, value]) => {
                                                const formatted =
                                                    formatMetadataValue(
                                                        key,
                                                        value,
                                                        hoveredResult.metadata,
                                                        hoveredResult.type
                                                    );
                                                if (!formatted) return null;
                                                const label =
                                                    translateMetadataField(
                                                        key,
                                                        hoveredResult.type
                                                    );
                                                return (
                                                    <Typography
                                                        key={key}
                                                        variant="caption"
                                                        sx={{
                                                            display: "block",
                                                            mb: 0.5,
                                                            textAlign:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "right"
                                                                    : "left",
                                                            direction:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                        }}
                                                    >
                                                        <strong>
                                                            {label}:
                                                        </strong>{" "}
                                                        {typeof formatted ===
                                                            "string" &&
                                                            (searchTerm ||
                                                                debouncedSearch)
                                                            ? highlightText(
                                                                formatted,
                                                                searchTerm ||
                                                                debouncedSearch
                                                            )
                                                            : formatted}
                                                    </Typography>
                                                );
                                            })}
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Box>
                )}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        placeholder={t("fields.global_search_placeholder", {
                            ns: "common",
                            defaultValue:
                                "Search customers, invoices, contacts, disputes...",
                        })}
                        inputRef={searchInputRef}
                        onKeyDown={handleKeyDown}
                        onFocus={(
                            e: React.FocusEvent<
                                HTMLInputElement | HTMLTextAreaElement
                            >
                        ) => {
                            setIsFocused(true);
                            // When input gets focus, it expands - wait for transition before showing dropdown
                            setIsWidthTransitionComplete(false);
                            if (transitionTimeoutRef.current) {
                                clearTimeout(transitionTimeoutRef.current);
                            }
                            transitionTimeoutRef.current = setTimeout(() => {
                                setIsWidthTransitionComplete(true);
                                // Only open dropdown if there's at least one character typed
                                if (searchTerm.length >= 1) {
                                    setIsOpen(true);
                                }
                            }, 250); // Wait for 0.2s transition + buffer
                            params.inputProps?.onFocus?.(e as any);
                        }}
                        onBlur={(
                            e: React.FocusEvent<
                                HTMLInputElement | HTMLTextAreaElement
                            >
                        ) => {
                            // Keep expanded if there's text, otherwise shrink
                            if (!searchTerm) {
                                setIsFocused(false);
                            }
                            params.inputProps?.onBlur?.(e as any);
                        }}
                        aria-label={t(
                            "fields.search_aria_label",
                            "Global search"
                        )}
                        aria-expanded={isOpen}
                        aria-autocomplete="list"
                        dir={i18n.language === "he" ? "rtl" : "ltr"}
                        InputProps={{
                            ...params.InputProps,
                            className: [
                                params.InputProps?.className,
                                "input-toolbar-height",
                            ]
                                .filter(Boolean)
                                .join(" "),
                            endAdornment: null, // Remove dropdown icon
                            startAdornment:
                                i18n.language === "he" ? (
                                    <>
                                        {isLoading ? (
                                            <InputAdornment position="start">
                                                <CircularProgress
                                                    color="inherit"
                                                    size={16}
                                                />
                                            </InputAdornment>
                                        ) : null}
                                        <InputAdornment position="end">
                                            <SearchIcon
                                                sx={{
                                                    color: "rgba(255, 255, 255, 0.7)",
                                                    fontSize: 16,
                                                }}
                                            />
                                        </InputAdornment>
                                    </>
                                ) : (
                                    <>
                                        <InputAdornment position="start">
                                            <SearchIcon
                                                sx={{
                                                    color: "rgba(255, 255, 255, 0.7)",
                                                    fontSize: 16,
                                                }}
                                            />
                                        </InputAdornment>
                                        {isLoading ? (
                                            <InputAdornment position="end">
                                                <CircularProgress
                                                    color="inherit"
                                                    size={16}
                                                />
                                            </InputAdornment>
                                        ) : null}
                                    </>
                                ),
                        }}
                    />
                )}
                renderOption={(props, option) => {
                    // Use the helper function for consistency
                    const index = displayResults.indexOf(option);
                    return renderResultOption(option, index, props);
                }}
                noOptionsText={
                    isError ? (
                        <Alert
                            severity="error"
                            sx={{
                                m: 1,
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {t(
                                "messages.search_error",
                                "Error loading results. Please try again."
                            )}
                        </Alert>
                    ) : isLoadingLastResults ? (
                        <Box
                            sx={{
                                p: 2,
                                display: "flex",
                                justifyContent: "center",
                            }}
                        >
                            <CircularProgress
                                color="primary"
                                size={20}
                            />
                        </Box>
                    ) : searchTerm.trim().length < 2 && !showLastResults ? (
                        <Box
                            sx={{
                                direction:
                                    `${i18n.language === "he" ? "rtl" : "ltr"} !important` as any,
                                textAlign:
                                    `${i18n.language === "he" ? "right" : "left"} !important` as any,
                                width: "100% !important",
                                minWidth: "100% !important",
                                maxWidth: "100% !important",
                                boxSizing: "border-box",
                                p: 1,
                                margin: 0,
                            }}
                        >
                            <Typography
                                component="span"
                                sx={{
                                    direction:
                                        `${i18n.language === "he" ? "rtl" : "ltr"} !important` as any,
                                    textAlign:
                                        `${i18n.language === "he" ? "right" : "left"} !important` as any,
                                    display: "block",
                                    width: "100%",
                                }}
                            >
                                {t(
                                    "messages.search_type_to_search",
                                    "Type at least 2 characters to search..."
                                )}
                            </Typography>
                        </Box>
                    ) : (
                        <Box
                            sx={{
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {/* Show header with filter chips when filters are active but no results match */}
                            {searchTerm &&
                                hasResults &&
                                filteredResults.length === 0 &&
                                selectedEntityTypes.size < 4 ? (
                                <>
                                    {renderResultCountHeader()}
                                    <Box
                                        sx={{
                                            p: 2,
                                            textAlign: "center",
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{
                                                mb: 1,
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            {t(
                                                "messages.no_results_match_filters",
                                                "No results match your selected filters"
                                            )}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            {t(
                                                "messages.click_filters_to_enable",
                                                "Click the filter chips above to enable more result types"
                                            )}
                                        </Typography>
                                    </Box>
                                </>
                            ) : (
                                <Box
                                    sx={{
                                        p: 2,
                                        textAlign: "center",
                                    }}
                                >
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        }}
                                    >
                                        {t(
                                            "messages.no_results",
                                            "No results found"
                                        )}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{
                                            mt: 1,
                                            display: "block",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        }}
                                    >
                                        {t(
                                            "messages.search_no_results_hint",
                                            "Try a different search term"
                                        )}
                                    </Typography>
                                </Box>
                            )}
                            {searchTerm.trim().length >= 2 && (
                                <Box
                                    sx={{
                                        mt: 2,
                                        p: 1.5,
                                        backgroundColor: alpha(
                                            theme.palette.info.main,
                                            0.1
                                        ),
                                        borderRadius: 1,
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                    }}
                                >
                                    <Typography
                                        variant="caption"
                                        fontWeight="medium"
                                        sx={{
                                            display: "block",
                                            mb: 0.5,
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                        }}
                                    >
                                        {t(
                                            "messages.search_tips_title",
                                            "Search Tips:"
                                        )}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        component="ul"
                                        sx={{
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            pl: i18n.language === "he" ? 0 : 2,
                                            pr: i18n.language === "he" ? 2 : 0,
                                            "& li": {
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            },
                                        }}
                                    >
                                        <li>
                                            {t(
                                                "messages.search_tip_customer",
                                                "Search by customer name or number"
                                            )}
                                        </li>
                                        <li>
                                            {t(
                                                "messages.search_tip_invoice",
                                                "Search by invoice number or customer"
                                            )}
                                        </li>
                                        <li>
                                            {t(
                                                "messages.search_tip_contact",
                                                "Search by contact name, email, or phone"
                                            )}
                                        </li>
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    )
                }
                loadingText={
                    <Box sx={{ p: 2 }}>
                        {[...Array(3)].map((_, i) => (
                            <Skeleton
                                key={i}
                                variant="rectangular"
                                height={60}
                                sx={{ mb: 1, borderRadius: 1 }}
                            />
                        ))}
                    </Box>
                }
                PopperComponent={CustomPopper}
            />
        </Box>
    );
};

export default GlobalSearch;
