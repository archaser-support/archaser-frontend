import { CustomerCollectionPeriod } from "@/types/db";

import { Invoice } from "@/types/Invoice";

export const getCustomerInvoiceData = (
    invoices: Partial<Invoice>[]
): Partial<CustomerCollectionPeriod> => {
    if (!invoices || !invoices?.length) {
        return {};
    }

    const uniqueCustomerCurrency = [
        ...Array.from(new Set(
            invoices
                ?.map((i) => i.customer_currency)
                .filter(Boolean)
                .sort((a, b) => {
                    if (a && b) {
                        return a.localeCompare(b);
                    }

                    return 0;
                })
        )), // added Boolean to filter non-null values
    ];

    let customerOutstanding1 = 0;
    let customerOutstanding2 = 0;

    let customerCurrency1 = "";
    let customerCurrency2 = "";

    if (uniqueCustomerCurrency.length === 1) {
        customerCurrency1 = uniqueCustomerCurrency?.[0] ?? "";
        customerOutstanding1 = invoices.reduce(
            (acc, oi) => acc + (oi.customer_outstanding_debt ?? 0),
            0
        );
    } else if (uniqueCustomerCurrency.length > 1) {
        customerCurrency1 = uniqueCustomerCurrency?.[0] ?? "";
        customerCurrency2 = uniqueCustomerCurrency?.[1] ?? "";
        customerOutstanding1 = invoices
            .filter((c) => c.customer_currency === customerCurrency1)
            .reduce((acc, oi) => acc + (oi.customer_outstanding_debt ?? 0), 0);
        customerOutstanding2 = invoices
            .filter((c) => c.customer_currency === customerCurrency2)
            .reduce((acc, oi) => acc + (oi.customer_outstanding_debt ?? 0), 0);
    }

    return {
        customer_currency1: customerCurrency1,
        customer_currency2: customerCurrency2,
        customer_outstanding_amount1: customerOutstanding1,
        customer_outstanding_amount2: customerOutstanding2,
    };
};
