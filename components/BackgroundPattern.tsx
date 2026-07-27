import { Box } from "@mui/material";

interface BackgroundPatternProps {
    children: React.ReactNode;
}

export default function BackgroundPattern({
    children,
}: BackgroundPatternProps) {
    return (
        <Box
            sx={{
                position: "relative",
                minHeight: "100vh",
                overflow: "hidden",
                "@keyframes float": {
                    "0%, 100%": {
                        transform: "translateY(0px) rotate(0deg)",
                    },
                    "33%": {
                        transform: "translateY(-20px) rotate(1deg)",
                    },
                    "66%": {
                        transform: "translateY(10px) rotate(-1deg)",
                    },
                },
                "@keyframes moveCircle1": {
                    "0%": { transform: "translate(0, 0)" },
                    "33%": { transform: "translate(150px, 80px)" },
                    "66%": { transform: "translate(-100px, 120px)" },
                    "100%": { transform: "translate(0, 0)" },
                },
                "@keyframes moveSquare1": {
                    "0%": { transform: "translate(0, 0) rotate(45deg)" },
                    "33%": { transform: "translate(-120px, 100px) rotate(45deg)" },
                    "66%": { transform: "translate(80px, -60px) rotate(45deg)" },
                    "100%": { transform: "translate(0, 0) rotate(45deg)" },
                },
                "@keyframes moveCircle2": {
                    "0%": { transform: "translate(0, 0)" },
                    "33%": { transform: "translate(100px, -90px)" },
                    "66%": { transform: "translate(-80px, -50px)" },
                    "100%": { transform: "translate(0, 0)" },
                },
                "@keyframes moveSquare2": {
                    "0%": { transform: "translate(0, 0) rotate(30deg)" },
                    "33%": { transform: "translate(90px, 70px) rotate(30deg)" },
                    "66%": { transform: "translate(-110px, 50px) rotate(30deg)" },
                    "100%": { transform: "translate(0, 0) rotate(30deg)" },
                },
                "@keyframes moveCircle3": {
                    "0%": { transform: "translate(0, 0)" },
                    "33%": { transform: "translate(-90px, 110px)" },
                    "66%": { transform: "translate(120px, -70px)" },
                    "100%": { transform: "translate(0, 0)" },
                },
                "@keyframes moveSquare3": {
                    "0%": { transform: "translate(0, 0) rotate(15deg)" },
                    "33%": { transform: "translate(70px, -80px) rotate(15deg)" },
                    "66%": { transform: "translate(-90px, 100px) rotate(15deg)" },
                    "100%": { transform: "translate(0, 0) rotate(15deg)" },
                },
                "&::before": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    zIndex: -2,
                },
                "&::after": {
                    content: '""',
                    position: "absolute",
                    top: "-50%",
                    left: "-50%",
                    right: "-50%",
                    bottom: "-50%",
                    background: `
                        radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
                        radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
                        radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.2) 0%, transparent 50%)
                    `,
                    animation: "float 20s ease-in-out infinite",
                    zIndex: -1,
                },
            }}
        >
            {/* Floating geometric shapes */}
            <Box
                sx={{
                    position: "absolute",
                    top: "10%",
                    left: "10%",
                    width: 100,
                    height: 100,
                    background: "rgba(255, 255, 255, 0.1)",
                    borderRadius: "50%",
                    animation: "moveCircle1 30s ease-in-out infinite",
                    zIndex: -1,
                }}
            />
            <Box
                sx={{
                    position: "absolute",
                    top: "20%",
                    right: "15%",
                    width: 60,
                    height: 60,
                    background: "rgba(255, 255, 255, 0.08)",
                    borderRadius: "8px",
                    transform: "rotate(45deg)",
                    animation: "moveSquare1 25s ease-in-out infinite",
                    zIndex: -1,
                }}
            />
            <Box
                sx={{
                    position: "absolute",
                    bottom: "15%",
                    left: "20%",
                    width: 80,
                    height: 80,
                    background: "rgba(255, 255, 255, 0.06)",
                    borderRadius: "50%",
                    animation: "moveCircle2 35s ease-in-out infinite",
                    zIndex: -1,
                }}
            />
            <Box
                sx={{
                    position: "absolute",
                    bottom: "25%",
                    right: "10%",
                    width: 40,
                    height: 40,
                    background: "rgba(255, 255, 255, 0.1)",
                    borderRadius: "4px",
                    transform: "rotate(30deg)",
                    animation: "moveSquare2 28s ease-in-out infinite",
                    zIndex: -1,
                }}
            />
            <Box
                sx={{
                    position: "absolute",
                    top: "60%",
                    left: "5%",
                    width: 70,
                    height: 70,
                    background: "rgba(255, 255, 255, 0.05)",
                    borderRadius: "50%",
                    animation: "moveCircle3 32s ease-in-out infinite",
                    zIndex: -1,
                }}
            />
            <Box
                sx={{
                    position: "absolute",
                    top: "30%",
                    left: "60%",
                    width: 50,
                    height: 50,
                    background: "rgba(255, 255, 255, 0.08)",
                    borderRadius: "8px",
                    transform: "rotate(15deg)",
                    animation: "moveSquare3 27s ease-in-out infinite",
                    zIndex: -1,
                }}
            />
            {children}
        </Box>
    );
}
