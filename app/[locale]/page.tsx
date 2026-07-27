"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Extract current locale from pathname and redirect to login page
        const currentLocale = pathname?.split("/")[1] || "en";
        router.push(`/${currentLocale}/login`);
    }, [router, pathname]);
    return (
        <div className="flex justify-center items-center min-h-screen">
            <div className="text-center">
                <h1 className="text-2xl font-semibold mb-4">
                    Welcome to Archaser
                </h1>
                <p className="text-gray-600">Redirecting to login...</p>
            </div>
        </div>
    );
}
