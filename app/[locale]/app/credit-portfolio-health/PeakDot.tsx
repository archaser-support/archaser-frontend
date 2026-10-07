import { chartColors } from "./chartColors";

/** Black dot with a white ring — readable on blue, orange, and the card background. */
export const PeakDot = ({ cx, cy }: { cx?: number; cy?: number }) =>
    cx == null || cy == null ? null : (
        <g>
            <circle cx={cx} cy={cy} r={7} fill={chartColors.marker} />
            <circle
                cx={cx}
                cy={cy}
                r={5.5}
                fill="none"
                stroke={chartColors.markerRing}
                strokeWidth={2}
            />
            <circle cx={cx} cy={cy} r={3.5} fill={chartColors.marker} />
        </g>
    );

/** `PeakDot` sized for HTML legends and tooltip rows. */
export function PeakDotSwatch({ size = 14 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 14 14"
            aria-hidden
            style={{ flexShrink: 0 }}
        >
            <PeakDot cx={7} cy={7} />
        </svg>
    );
}
