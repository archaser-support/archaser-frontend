export type Currency = {
    code: string;
    symbol: string;
    name: string;
};

export const currencies: Currency[] = [
    { code: "USD", symbol: "$", name: "United States Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "JPY", symbol: "¥", name: "Japanese Yen" },
    { code: "GBP", symbol: "£", name: "British Pound Sterling" },
    { code: "AUD", symbol: "A$", name: "Australian Dollar" },
    { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
    { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
    { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
    { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
    { code: "INR", symbol: "₹", name: "Indian Rupee" },
    { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
    { code: "SEK", symbol: "kr", name: "Swedish Krona" },
    { code: "KRW", symbol: "₩", name: "South Korean Won" },
    { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
    { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
    { code: "MXN", symbol: "$", name: "Mexican Peso" },
    { code: "ZAR", symbol: "R", name: "South African Rand" },
    { code: "BRL", symbol: "R$", name: "Brazilian Real" },
    { code: "RUB", symbol: "₽", name: "Russian Ruble" },
    { code: "TRY", symbol: "₺", name: "Turkish Lira" },
    { code: "AED", symbol: "د.إ", name: "United Arab Emirates Dirham" },
    { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
    { code: "ILS", symbol: "₪", name: "Israeli New Shekel" },
    { code: "PLN", symbol: "zł", name: "Polish Zloty" },
    { code: "THB", symbol: "฿", name: "Thai Baht" },
];
