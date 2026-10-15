"use client";

import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import React from "react";

// Artwork source: archaser-track-runner.svg. SMIL run cycle + track dashes;
// reduced-motion shows a stationary pose via the embedded stylesheet.
// Cropped to the runner + track (source canvas is 160² with empty padding).
const VIEW = { minX: 28, minY: 10, width: 108, height: 142 };

/** Canonical rendered height (px) for the loading track-runner mark. */
export const ARCHASER_TRACK_RUNNER_HEIGHT_PX = 48;

type ArchaserTrackRunnerProps = {
    /** Rendered height in px; width follows the cropped artwork aspect ratio. */
    height?: number;
    /** Accessible name. Omit when a parent already exposes loading status. */
    title?: string;
    sx?: SxProps<Theme>;
};

/**
 * Animated ARChaser track-runner mark for loading indicators only.
 * Inherits CSS `color`. Brand/navigation logos use `ArchaserLogo`.
 */
const ArchaserTrackRunner = ({
    height = ARCHASER_TRACK_RUNNER_HEIGHT_PX,
    title,
    sx,
}: ArchaserTrackRunnerProps) => {
    const width = (height * VIEW.width) / VIEW.height;
    const accessibilityProps = title
        ? { role: "img" as const, "aria-label": title }
        : { "aria-hidden": true as const };

    return (
        <Box
            component="svg"
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`${VIEW.minX} ${VIEW.minY} ${VIEW.width} ${VIEW.height}`}
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
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
        >
            <title>ARChaser — running on a track</title>
            <desc>
                A 0.9-second running cycle with coordinated limbs, slight body
                rise and fall, and ground dashes moving left. Transparent,
                themeable with currentColor. Reduced-motion mode shows a
                stationary pose.
            </desc>
            <style>
                {
                    ".ar-track-still{display:none}@media(prefers-reduced-motion:reduce){.ar-track-motion{display:none}.ar-track-still{display:inline}}"
                }
            </style>
            <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <g className="ar-track-motion">
                    <path
                        d="M72 77 L69.99 108.94 L36 108 l7 0"
                        strokeWidth={12}
                        opacity={0.55}
                    >
                        <animate
                            attributeName="d"
                            values="M72 77 L69.99 108.94 L36 108 l7 0;M72 80 L83.93 109.69 L52 98 l7 0;M72 77 L103.94 75.12 L86 104 l7 0;M72 74 L102.88 82.39 L108 116 l7 0;M72 77 L94.64 99.62 L105 132 l7 0;M72 80 L93.73 103.49 L88 137 l7 0;M72 77 L81.82 107.45 L65 137 l7 0;M72 74 L62.70 104.62 L39 129 l7 0;M72 77 L69.99 108.94 L36 108 l7 0"
                            dur="0.9s"
                            repeatCount="indefinite"
                            calcMode="linear"
                        />
                    </path>
                    <path
                        d="M89 49 L73.61 66.09 L87.77 84.22"
                        strokeWidth={11}
                        opacity={0.55}
                    >
                        <animate
                            attributeName="d"
                            values="M89 49 L73.61 66.09 L87.77 84.22;M89 52 L81.89 73.87 L102.20 84.67;M89 49 L93.78 71.50 L116.77 70.69;M89 46 L103.16 64.12 L123.47 53.33;M89 49 L106.09 64.39 L124.22 50.23;M89 52 L98.72 72.85 L120.94 66.89;M89 49 L87.00 71.91 L109.21 77.87;M89 46 L76.81 65.51 L93.90 80.90;M89 49 L73.61 66.09 L87.77 84.22"
                            dur="0.9s"
                            repeatCount="indefinite"
                            calcMode="linear"
                        />
                    </path>
                    <path d="M89 49 L72 77" strokeWidth={17} opacity={1}>
                        <animate
                            attributeName="d"
                            values="M89 49 L72 77;M89 52 L72 80;M89 49 L72 77;M89 46 L72 74;M89 49 L72 77;M89 52 L72 80;M89 49 L72 77;M89 46 L72 74;M89 49 L72 77"
                            dur="0.9s"
                            repeatCount="indefinite"
                            calcMode="linear"
                        />
                    </path>
                    <path
                        d="M72 77 L94.64 99.62 L105 132 l7 0"
                        strokeWidth={13}
                        opacity={1}
                    >
                        <animate
                            attributeName="d"
                            values="M72 77 L94.64 99.62 L105 132 l7 0;M72 80 L93.73 103.49 L88 137 l7 0;M72 77 L81.82 107.45 L65 137 l7 0;M72 74 L62.70 104.62 L39 129 l7 0;M72 77 L69.99 108.94 L36 108 l7 0;M72 80 L83.93 109.69 L52 98 l7 0;M72 77 L103.94 75.12 L86 104 l7 0;M72 74 L102.88 82.39 L108 116 l7 0;M72 77 L94.64 99.62 L105 132 l7 0"
                            dur="0.9s"
                            repeatCount="indefinite"
                            calcMode="linear"
                        />
                    </path>
                    <path
                        d="M89 49 L106.09 64.39 L124.22 50.23"
                        strokeWidth={12}
                        opacity={1}
                    >
                        <animate
                            attributeName="d"
                            values="M89 49 L106.09 64.39 L124.22 50.23;M89 52 L98.72 72.85 L120.94 66.89;M89 49 L87.00 71.91 L109.21 77.87;M89 46 L76.81 65.51 L93.90 80.90;M89 49 L73.61 66.09 L87.77 84.22;M89 52 L81.89 73.87 L102.20 84.67;M89 49 L93.78 71.50 L116.77 70.69;M89 46 L103.16 64.12 L123.47 53.33;M89 49 L106.09 64.39 L124.22 50.23"
                            dur="0.9s"
                            repeatCount="indefinite"
                            calcMode="linear"
                        />
                    </path>
                    <circle
                        cx={102}
                        cy={24}
                        r={11}
                        fill="currentColor"
                        stroke="none"
                    >
                        <animate
                            attributeName="cy"
                            values="24;27;24;21;24;27;24;21;24"
                            dur="0.9s"
                            repeatCount="indefinite"
                        />
                    </circle>
                    <path d="M0 149h19" strokeWidth={3} opacity={0}>
                        <animateTransform
                            attributeName="transform"
                            type="translate"
                            from="132 0"
                            to="9 0"
                            dur="0.9s"
                            begin="0s"
                            repeatCount="indefinite"
                        />
                        <animate
                            attributeName="opacity"
                            values="0;.32;.32;0"
                            keyTimes="0;.15;.85;1"
                            dur="0.9s"
                            begin="0s"
                            repeatCount="indefinite"
                        />
                    </path>
                    <path d="M0 149h19" strokeWidth={3} opacity={0}>
                        <animateTransform
                            attributeName="transform"
                            type="translate"
                            from="132 0"
                            to="9 0"
                            dur="0.9s"
                            begin="-0.45s"
                            repeatCount="indefinite"
                        />
                        <animate
                            attributeName="opacity"
                            values="0;.32;.32;0"
                            keyTimes="0;.15;.85;1"
                            dur="0.9s"
                            begin="-0.45s"
                            repeatCount="indefinite"
                        />
                    </path>
                </g>
                <g className="ar-track-still">
                    <path
                        d="M72 77 L69.99 108.94 L36 108 l7 0"
                        strokeWidth={12}
                        opacity={0.55}
                    />
                    <path
                        d="M89 49 L73.61 66.09 L87.77 84.22"
                        strokeWidth={11}
                        opacity={0.55}
                    />
                    <path d="M89 49 L72 77" strokeWidth={17} opacity={1} />
                    <path
                        d="M72 77 L94.64 99.62 L105 132 l7 0"
                        strokeWidth={13}
                        opacity={1}
                    />
                    <path
                        d="M89 49 L106.09 64.39 L124.22 50.23"
                        strokeWidth={12}
                        opacity={1}
                    />
                    <circle
                        cx={102}
                        cy={24}
                        r={11}
                        fill="currentColor"
                        stroke="none"
                    />
                    <path
                        d="M32 149h19M92 149h19"
                        strokeWidth={3}
                        opacity={0.32}
                    />
                </g>
            </g>
        </Box>
    );
};

export default ArchaserTrackRunner;
