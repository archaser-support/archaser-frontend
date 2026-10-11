"use client";

import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { keyframes } from "@mui/system";
import React from "react";

// Artwork source: archaser-logo-refined.svg. All shapes paint with currentColor.
const FULL_VIEWBOX = { minX: 0, minY: 0, width: 643.4, height: 152 };
// Exact bounds of the stroked runner + trails (round caps and joins included).
const MARK_VIEWBOX = { minX: 8, minY: 14, width: 124, height: 119 };

const TRAIL_CYCLE_MS = 1200;
const TRAIL_PHASE_MS = 400;

const TRAILS = ["M19 33H47", "M12 49H37", "M19 65H41"];

const WORDMARK_GLYPHS = [
    {
        x: 163,
        d: "M474 219 549 0H653L397 729H277L17 0H116L193 219ZM448 297H216L336 629Z",
    },
    {
        x: 229.85,
        d: "M186 314H426C509 314 546 274 546 184L545 119C545 74 553 30 566 0H679V23C644 47 637 73 635 170C634 290 615 326 536 360C618 401 651 450 651 534C651 660 573 729 429 729H93V0H186ZM186 396V647H411C463 647 493 639 516 619C541 598 554 565 554 522C554 435 510 396 411 396Z",
    },
    {
        x: 302.2,
        d: "M662 503C633 663 541 741 381 741C283 741 204 710 150 650C84 578 48 474 48 356C48 236 85 133 153 62C210 4 282 -23 377 -23C555 -23 655 73 677 266H581C573 216 563 182 548 153C518 93 456 59 378 59C233 59 141 175 141 357C141 544 228 659 370 659C429 659 484 642 514 613C541 588 556 558 567 503Z",
    },
    {
        x: 374.55,
        d: "M70 729V0H153V289C153 396 209 466 295 466C323 466 349 458 369 443C393 425 403 400 403 363V0H486V396C486 484 423 539 321 539C247 539 202 516 153 452V729Z",
    },
    {
        x: 430.3,
        d: "M535 49C526 47 522 47 517 47C488 47 472 62 472 88V396C472 489 404 539 275 539C198 539 137 517 101 478C77 451 67 421 65 369H149C156 433 194 462 272 462C348 462 389 434 389 384V362C388 326 370 313 302 304C184 289 166 285 134 272C73 246 42 200 42 132C42 37 108 -23 214 -23C280 -23 333 0 392 54C398 0 424 -23 478 -23C496 -23 507 -21 535 -14ZM389 165C389 137 381 120 356 97C322 66 281 50 232 50C167 50 129 81 129 134C129 189 165 217 255 230C344 242 361 246 389 259Z",
    },
    {
        x: 486.05,
        d: "M438 378C437 481 369 539 248 539C126 539 47 476 47 379C47 297 89 258 213 228L291 209C349 195 372 174 372 137C372 87 323 54 250 54C205 54 167 67 146 89C133 104 127 119 122 156H34C38 35 106 -23 243 -23C375 -23 459 42 459 143C459 221 415 264 311 289L231 308C163 324 134 346 134 383C134 432 177 462 245 462C312 462 348 433 350 378Z",
    },
    {
        x: 536.2,
        d: "M513 234C513 314 507 362 492 401C458 487 378 539 280 539C134 539 40 428 40 255C40 82 130 -23 278 -23C398 -23 481 45 502 159H418C395 90 348 54 281 54C228 54 183 78 155 122C135 152 128 182 127 234ZM129 302C136 399 195 462 279 462C364 462 423 396 423 302Z",
    },
    {
        x: 591.95,
        d: "M69 524V0H153V272C154 398 206 454 321 451V536C307 538 299 539 289 539C235 539 194 507 146 429V524Z",
    },
];

const trailPulse = keyframes`
    0%, 100% { opacity: 0.25; }
    50% { opacity: 1; }
`;

const animatedTrailsSx = {
    "& .archaser-logo-trail": {
        animation: `${trailPulse} ${TRAIL_CYCLE_MS}ms ease-in-out infinite`,
        "@media (prefers-reduced-motion: reduce)": {
            animation: "none",
        },
    },
    // Negative delays start every trail mid-cycle, each lagging the one above by one phase.
    ...Object.fromEntries(
        TRAILS.map((_, index) => [
            `& .archaser-logo-trail-${index + 1}`,
            {
                animationDelay: `${
                    -((TRAIL_CYCLE_MS - index * TRAIL_PHASE_MS) % TRAIL_CYCLE_MS)
                }ms`,
            },
        ])
    ),
};

type ArchaserLogoProps = {
    /** `full` = runner + wordmark; `mark` = runner + trails only, for compact placements. */
    variant?: "full" | "mark";
    /** Rendered height in px; width follows the artwork's aspect ratio. */
    height?: number;
    /** Pulse the motion trails (loading indicators only; keep static in navigation). */
    animated?: boolean;
    /** Accessible name. Omit when the logo is decorative (e.g. a separate loading status exists). */
    title?: string;
    sx?: SxProps<Theme>;
};

/**
 * ARChaser application logo. Inherits CSS `color`, so set it on the logo (or a parent)
 * to match the surface. Never use for tenant-uploaded account logos.
 */
const ArchaserLogo = ({
    variant = "full",
    height = 32,
    animated = false,
    title,
    sx,
}: ArchaserLogoProps) => {
    const viewBox = variant === "full" ? FULL_VIEWBOX : MARK_VIEWBOX;
    const width = (height * viewBox.width) / viewBox.height;
    const accessibilityProps = title
        ? { role: "img", "aria-label": title }
        : { "aria-hidden": true };

    return (
        <Box
            component="svg"
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
            width={width}
            height={height}
            fill="none"
            focusable="false"
            {...accessibilityProps}
            sx={[
                {
                    display: "block",
                    flexShrink: 0,
                    overflow: "visible",
                },
                animated ? animatedTrailsSx : {},
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
        >
            <g
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <g strokeWidth={8}>
                    {TRAILS.map((d, index) => (
                        <path
                            key={d}
                            className={`archaser-logo-trail archaser-logo-trail-${index + 1}`}
                            d={d}
                        />
                    ))}
                </g>
                <circle cx={106} cy={26} r={12} fill="currentColor" stroke="none" />
                <path d="M57 52L75 34L86 44" strokeWidth={15} />
                <path d="M90 54L70 74L89 93L64 124" strokeWidth={18} />
                <path d="M91 55L99 65H124" strokeWidth={16} />
                <path d="M58 91L25 124" strokeWidth={17} />
            </g>
            {variant === "full" ? (
                <g fill="currentColor">
                    {WORDMARK_GLYPHS.map((glyph) => (
                        <path
                            key={glyph.x}
                            transform={`translate(${glyph.x} 110) scale(0.1 -0.1)`}
                            d={glyph.d}
                        />
                    ))}
                </g>
            ) : null}
        </Box>
    );
};

export default ArchaserLogo;
