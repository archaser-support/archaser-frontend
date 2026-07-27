import Link from "next/link";

export default function NotFound() {
    return (
        <html>
            <body>
                <div className="flex flex-col items-center justify-center min-h-screen">
                    <p className="mb-4 text-xl">The Above Url Cannot Found</p>
                    <Link href="/app/dashboard" className="btn btn-primary">
                        Return Home
                    </Link>
                </div>
            </body>
        </html>
    );
}
