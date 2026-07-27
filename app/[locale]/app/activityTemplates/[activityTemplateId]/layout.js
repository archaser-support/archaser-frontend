import initTranslations from "@/app/i18n";
import TranslationsProvider from "@/components/TranslationsProvider";
import { getPrismaSafe } from "@/utils/prismaSafe";

const i18nNamespaces = ["activityTemplates", "common"];

function extractTemplateName(template) {
    return template?.name || "Activity Template Details";
}

// Metadata generation
export async function generateMetadata() {
    return {
        title: "Activity Template",
    };
}

export default async function Layout({ children, params }) {
    const { activityTemplateId, locale } = await params;

    const { t, resources } = await initTranslations(locale, i18nNamespaces);

    const prisma = await getPrismaSafe();
    if (!prisma) {
        return (
            <TranslationsProvider
                namespaces={i18nNamespaces}
                locale={locale}
                resources={resources}
            >
                <div className="container p-4 mx-auto text-center text-gray-200">
                    <h2 className="text-3xl font-bold">
                        {t("template_not_found")}
                    </h2>
                </div>
            </TranslationsProvider>
        );
    }

    // Fetch activity template details
    const activityTemplate = await prisma.ActivitiesTemplate.findUnique({
        where: {
            id: parseInt(activityTemplateId, 10),
        },
    });

    if (!activityTemplate) {
        return (
            <TranslationsProvider
                namespaces={i18nNamespaces}
                locale={locale}
                resources={resources}
            >
                <div className="container p-4 mx-auto text-center text-gray-200">
                    <h2 className="text-3xl font-bold">
                        {t("template_not_found")}
                    </h2>
                </div>
            </TranslationsProvider>
        );
    }

    return (
        <TranslationsProvider
            namespaces={i18nNamespaces}
            locale={locale}
            resources={resources}
        >
            <div className="p-4">
                <h2 className="mb-2 text-3xl font-bold inline-flex items-center">
                    {activityTemplate.active ? (
                        <span
                            className="hs-tooltip-toggle w-2 h-2 inline-block bg-green-500 rounded-full me-2"
                            type="button"
                         />
                    ) : (
                        <span
                            className="hs-tooltip-toggle w-2 h-2 inline-block bg-gray-500 rounded-full me-2"
                            type="button"
                         />
                    )}
                    {extractTemplateName(activityTemplate)}
                </h2>
                <div className="flex flex-col">
                    <div className="box-body">
                        <div>{children}</div>
                    </div>
                </div>
            </div>
        </TranslationsProvider>
    );
}
