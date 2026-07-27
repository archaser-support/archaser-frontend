import { Space_Grotesk } from "next/font/google";

/** Route-scoped display font for Halo / KPI numerals (Inter remains for labels). */
export const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-space-grotesk",
});
