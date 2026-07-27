import CustomerDetailsWrapper from "./CustomerDetailsWrapper";

type PageProps = {
    params: Promise<{ customerId: string; locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function Home({ params }: PageProps) {
    const { customerId } = await params;

    return <CustomerDetailsWrapper customerId={customerId} />;
}
