import React from "react";
import { Box } from "@mui/material";
import { HighlightTextProps } from "../types";

/**
 * HighlightText component for search highlighting
 * Highlights matching text in search results
 */
export const HighlightText: React.FC<HighlightTextProps> = ({
    text,
    searchTerm,
    highlightStyle,
    language = "en",
}) => {
    // Trim search term to remove leading/trailing spaces
    const trimmedSearchTerm = searchTerm?.trim();

    // Detect Hebrew from search term or text if language prop is incorrect
    // Hebrew Unicode range: \u0590-\u05FF
    const hebrewRegex = /[\u0590-\u05FF]/;
    const hasHebrewInSearch =
        trimmedSearchTerm && hebrewRegex.test(trimmedSearchTerm);
    const hasHebrewInText = typeof text === "string" && hebrewRegex.test(text);
    const effectiveLanguage =
        hasHebrewInSearch || hasHebrewInText ? "he" : language;

    if (!trimmedSearchTerm || !text) {
        return (
            <span
                style={{
                    direction: effectiveLanguage === "he" ? "rtl" : "ltr",
                }}
            >
                {text}
            </span>
        );
    }

    // Default highlight style - use standard CSS values (fontWeight 700 matches theme.fontWeightBold)
    const defaultHighlightStyle: React.CSSProperties = {
        backgroundColor: "#ffeb3b",
        fontWeight: 700, // Matches theme.typography.fontWeightBold
        padding: "1px 2px",
        borderRadius: "2px",
    };

    const finalHighlightStyle = highlightStyle || defaultHighlightStyle;

    // Check if this is a numeric search that might match formatted numbers
    const isNumericSearch = !isNaN(parseFloat(trimmedSearchTerm));
    const searchNumber = isNumericSearch ? parseFloat(trimmedSearchTerm) : null;

    // First try exact text matching
    // Escape special regex characters, but preserve Hebrew/Unicode characters
    const escapedSearchTerm = trimmedSearchTerm.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
    // Use Unicode flag (u) for proper Hebrew/Unicode character matching
    const textRegex = new RegExp(`(${escapedSearchTerm})`, "giu");
    const textParts = text.split(textRegex);

    // If we have exact text matches, use them
    if (textParts.length > 1) {
        return (
            <span
                style={{
                    direction: effectiveLanguage === "he" ? "rtl" : "ltr",
                }}
            >
                {textParts.map((part, index) => {
                    // Create a fresh regex for each test to avoid state issues
                    // Use Unicode flag for Hebrew/Unicode character matching
                    const freshRegex = new RegExp(
                        `^${escapedSearchTerm}$`,
                        "iu"
                    );
                    if (freshRegex.test(part)) {
                        return (
                            <Box
                                key={index}
                                component="span"
                                sx={{
                                    ...finalHighlightStyle,
                                    direction:
                                        effectiveLanguage === "he"
                                            ? "rtl"
                                            : "ltr",
                                    display: "inline",
                                }}
                            >
                                {part}
                            </Box>
                        );
                    }
                    return (
                        <span
                            key={index}
                            style={{
                                direction:
                                    effectiveLanguage === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {part}
                        </span>
                    );
                })}
            </span>
        );
    }

    // If no exact text match and it's a numeric search, try to match formatted numbers
    if (isNumericSearch && searchNumber !== null) {
        // Look for numbers in the text that match our search number (including negative numbers)
        const numberPattern = /(-?\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?)/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = numberPattern.exec(text)) !== null) {
            // Add text before the number
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }

            // Check if this number matches our search (remove formatting and compare)
            const matchClean = match[1].replace(/[,\s]/g, "");
            const matchNumber = parseFloat(matchClean);
            const shouldHighlight =
                !isNaN(matchNumber) && matchNumber === searchNumber;

            if (shouldHighlight) {
                parts.push(
                    <Box
                        key={parts.length}
                        component="span"
                        sx={{
                            ...finalHighlightStyle,
                            direction:
                                effectiveLanguage === "he" ? "rtl" : "ltr",
                            display: "inline",
                        }}
                    >
                        {match[1]}
                    </Box>
                );
            } else {
                parts.push(
                    <span
                        key={parts.length}
                        style={{
                            direction:
                                effectiveLanguage === "he" ? "rtl" : "ltr",
                        }}
                    >
                        {match[1]}
                    </span>
                );
            }

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text after the last number
        if (lastIndex < text.length) {
            parts.push(
                <span
                    key={parts.length}
                    style={{
                        direction: effectiveLanguage === "he" ? "rtl" : "ltr",
                    }}
                >
                    {text.slice(lastIndex)}
                </span>
            );
        }

        return (
            <span
                style={{
                    direction: effectiveLanguage === "he" ? "rtl" : "ltr",
                }}
            >
                {parts}
            </span>
        );
    }

    // No matches found
    return (
        <span style={{ direction: effectiveLanguage === "he" ? "rtl" : "ltr" }}>
            {text}
        </span>
    );
};
