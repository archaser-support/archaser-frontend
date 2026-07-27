import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush, back: vi.fn() }),
    usePathname: () => "/en/app/customers/1",
}));

vi.mock("next-auth/react", () => ({
    useSession: () => ({
        data: { user: { id: "1", account_id: 20001 } },
        status: "authenticated",
    }),
}));

vi.mock("next/image", () => ({
    default: (props: { alt?: string }) => <img alt={props.alt} />,
}));

vi.mock("@/shared/utility/LogCreator", () => ({
    createLogRecord: vi.fn(),
}));

const useAppHomePathMock = vi.fn();

vi.mock("@/hooks/useAppHomePath", () => ({
    useAppHomePath: () => useAppHomePathMock(),
}));

import AccessDenied from "@/components/AccessDenied";

describe("AccessDenied Go Home", () => {
    beforeEach(() => {
        mockPush.mockClear();
        useAppHomePathMock.mockReturnValue({
            homePath: "/app/credit-dashboard",
            isLoading: false,
        });
    });

    it("navigates to resolved home path with locale prefix", () => {
        render(<AccessDenied />);

        fireEvent.click(screen.getByRole("button", { name: "Go Home" }));

        expect(mockPush).toHaveBeenCalledWith("/en/app/credit-dashboard");
    });

    it("disables Go Home while home path is loading", () => {
        useAppHomePathMock.mockReturnValue({
            homePath: null,
            isLoading: true,
        });

        render(<AccessDenied />);

        expect(
            screen.getByRole("button", { name: "Go Home" })
        ).toBeDisabled();
    });
});
