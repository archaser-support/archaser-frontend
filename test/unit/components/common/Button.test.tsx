import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

// Simple Button component for testing
function Button({
    onClick,
    children,
    disabled = false,
    variant = "primary",
}: {
    onClick?: () => void;
    children: React.ReactNode;
    disabled?: boolean;
    variant?: "primary" | "secondary";
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`btn btn-${variant}`}
            data-testid="button"
        >
            {children}
        </button>
    );
}

describe("Button Component", () => {
    afterEach(() => {
        cleanup();
    });

    it("should render with children", () => {
        const { getByText } = render(<Button>Click me</Button>);
        const button = getByText("Click me");
        expect(button).toBeTruthy();
        expect(button.textContent).toBe("Click me");
    });

    it("should call onClick when clicked", () => {
        const handleClick = vi.fn();
        const { getByTestId } = render(<Button onClick={handleClick}>Click me</Button>);

        fireEvent.click(getByTestId("button"));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should be disabled when disabled prop is true", () => {
        const { getByTestId } = render(<Button disabled>Click me</Button>);
        const button = getByTestId("button") as HTMLButtonElement;
        expect(button.disabled).toBe(true);
    });

    it("should have correct variant class", () => {
        const { getByTestId } = render(<Button variant="secondary">Click me</Button>);
        const button = getByTestId("button");
        expect(button.className).toContain("btn-secondary");
    });
});
