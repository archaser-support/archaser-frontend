import { countries } from "countries-list";

interface CountryInfo {
    id: number;
    name: string;
    phonecode: string;
    iso2: string;
}

// Canadian area codes (as of 2024)
const CANADIAN_AREA_CODES = [
    "204",
    "226",
    "236",
    "249",
    "250",
    "289",
    "306",
    "343",
    "354",
    "365",
    "367",
    "368",
    "403",
    "416",
    "418",
    "431",
    "437",
    "438",
    "450",
    "506",
    "514",
    "519",
    "548",
    "579",
    "581",
    "587",
    "604",
    "613",
    "639",
    "647",
    "705",
    "709",
    "778",
    "780",
    "782",
    "807",
    "819",
    "825",
    "867",
    "873",
    "902",
    "905",
];

// USA area codes (major ones - this is not exhaustive but covers most common ones)
const USA_AREA_CODES = [
    "201",
    "202",
    "203",
    "205",
    "206",
    "207",
    "208",
    "209",
    "210",
    "212",
    "213",
    "214",
    "215",
    "216",
    "217",
    "218",
    "219",
    "220",
    "223",
    "224",
    "225",
    "228",
    "229",
    "231",
    "234",
    "239",
    "240",
    "248",
    "251",
    "252",
    "253",
    "254",
    "256",
    "260",
    "262",
    "267",
    "269",
    "270",
    "272",
    "276",
    "281",
    "301",
    "302",
    "303",
    "304",
    "305",
    "307",
    "308",
    "309",
    "310",
    "312",
    "313",
    "314",
    "315",
    "316",
    "317",
    "318",
    "319",
    "320",
    "321",
    "323",
    "325",
    "330",
    "331",
    "334",
    "336",
    "337",
    "339",
    "340",
    "341",
    "347",
    "351",
    "352",
    "360",
    "361",
    "364",
    "380",
    "385",
    "386",
    "401",
    "402",
    "404",
    "405",
    "406",
    "407",
    "408",
    "409",
    "410",
    "412",
    "413",
    "414",
    "415",
    "417",
    "419",
    "423",
    "424",
    "425",
    "430",
    "432",
    "434",
    "435",
    "440",
    "443",
    "445",
    "447",
    "458",
    "463",
    "469",
    "470",
    "475",
    "478",
    "479",
    "480",
    "484",
    "501",
    "502",
    "503",
    "504",
    "505",
    "507",
    "508",
    "509",
    "510",
    "512",
    "513",
    "515",
    "516",
    "517",
    "518",
    "520",
    "530",
    "531",
    "534",
    "539",
    "540",
    "541",
    "551",
    "555",
    "559",
    "561",
    "562",
    "563",
    "567",
    "570",
    "571",
    "573",
    "574",
    "575",
    "580",
    "585",
    "586",
    "601",
    "602",
    "603",
    "605",
    "606",
    "607",
    "608",
    "609",
    "610",
    "612",
    "614",
    "615",
    "616",
    "617",
    "618",
    "619",
    "620",
    "623",
    "626",
    "628",
    "629",
    "630",
    "631",
    "636",
    "641",
    "646",
    "650",
    "651",
    "657",
    "660",
    "661",
    "662",
    "667",
    "669",
    "678",
    "681",
    "682",
    "701",
    "702",
    "703",
    "704",
    "706",
    "707",
    "708",
    "712",
    "713",
    "714",
    "715",
    "716",
    "717",
    "718",
    "719",
    "720",
    "724",
    "725",
    "727",
    "731",
    "732",
    "734",
    "737",
    "740",
    "743",
    "747",
    "754",
    "757",
    "760",
    "762",
    "763",
    "765",
    "769",
    "770",
    "772",
    "773",
    "774",
    "775",
    "779",
    "781",
    "785",
    "786",
    "801",
    "802",
    "803",
    "804",
    "805",
    "806",
    "808",
    "810",
    "812",
    "813",
    "814",
    "815",
    "816",
    "817",
    "818",
    "828",
    "830",
    "831",
    "832",
    "843",
    "845",
    "847",
    "848",
    "850",
    "856",
    "857",
    "858",
    "859",
    "860",
    "862",
    "863",
    "864",
    "865",
    "870",
    "872",
    "878",
    "901",
    "903",
    "904",
    "906",
    "907",
    "908",
    "909",
    "910",
    "912",
    "913",
    "914",
    "915",
    "916",
    "917",
    "918",
    "919",
    "920",
    "925",
    "928",
    "929",
    "930",
    "931",
    "934",
    "936",
    "937",
    "938",
    "940",
    "941",
    "947",
    "949",
    "951",
    "952",
    "954",
    "956",
    "959",
    "970",
    "971",
    "972",
    "973",
    "975",
    "978",
    "979",
    "980",
    "984",
    "985",
    "989",
];

/**
 * Determines if a +1 phone number is Canadian or USA based on area code
 * @param phoneNumber - The phone number to analyze (should start with +1)
 * @returns 'CA' for Canadian, 'US' for USA, or null if cannot determine
 */
function determineNorthAmericanCountry(
    phoneNumber: string
): "CA" | "US" | null {
    if (!phoneNumber || !phoneNumber.startsWith("+1")) {
        return null;
    }

    // Remove +1 and get the remaining digits
    const numberWithoutCountryCode = phoneNumber
        .replace(/^\+1/, "")
        .replace(/[\s\-()]/g, "");

    // Extract area code (first 3 digits)
    const areaCode = numberWithoutCountryCode.substring(0, 3);

    if (CANADIAN_AREA_CODES.includes(areaCode)) {
        return "CA";
    } else if (USA_AREA_CODES.includes(areaCode)) {
        return "US";
    }

    // If area code is not in our lists, we can't determine
    // In this case, we'll default to US (more common)
    return "US";
}

/**
 * Extracts country code from phone number and returns country information
 * @param phoneNumber - The phone number to parse
 * @returns Country info if found, null otherwise
 */
export function identifyCountryFromPhoneNumber(
    phoneNumber: string
): CountryInfo | null {
    if (!phoneNumber || typeof phoneNumber !== "string") {
        return null;
    }

    // Clean the phone number - remove spaces, dashes, parentheses
    const cleanedNumber = phoneNumber.replace(/[\s\-()]/g, "");

    // If number starts with +, remove it for processing
    const numberWithoutPlus = cleanedNumber.startsWith("+")
        ? cleanedNumber.slice(1)
        : cleanedNumber;

    // Special handling for +1 numbers (Canada and USA)
    if (cleanedNumber.startsWith("+1")) {
        const northAmericanCountry =
            determineNorthAmericanCountry(cleanedNumber);
        if (northAmericanCountry) {
            return {
                id: 0, // Will be resolved by database lookup
                name:
                    northAmericanCountry === "CA" ? "Canada" : "United States",
                phonecode: "1",
                iso2: northAmericanCountry,
            };
        }
    }

    // Try to match country codes (1-4 digits)
    for (let codeLength = 4; codeLength >= 1; codeLength--) {
        const potentialCode = numberWithoutPlus.substring(0, codeLength);

        // Find country by phone code - prefer exact matches
        let countryEntry = Object.entries(countries).find(([code, country]) => {
            return (
                country.phone &&
                country.phone.includes(parseInt(potentialCode)) &&
                country.phone[0].toString() === potentialCode
            );
        });

        // If no exact match, find any match
        if (!countryEntry) {
            countryEntry = Object.entries(countries).find(([code, country]) => {
                return (
                    country.phone &&
                    country.phone.includes(parseInt(potentialCode))
                );
            });
        }

        if (countryEntry) {
            const [iso2, country] = countryEntry;

            return {
                id: 0, // Will be resolved by database lookup
                name: country.name,
                phonecode: country.phone[0].toString(),
                iso2: iso2.toUpperCase(),
            };
        }
    }

    return null;
}

/**
 * Validates if a phone number has a valid format
 * @param phoneNumber - The phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
    if (!phoneNumber || typeof phoneNumber !== "string") {
        return false;
    }

    // Basic validation - allows digits, spaces, dashes, parentheses, and plus sign
    const phoneRegex = /^[+]?[0-9\s\-()]+$/;
    return phoneRegex.test(phoneNumber);
}

/**
 * Formats phone number to international format
 * @param phoneNumber - The phone number to format
 * @param countryCode - Optional country code to use for formatting
 * @returns Formatted phone number
 */
export function formatPhoneNumber(
    phoneNumber: string,
    countryCode?: string
): string {
    if (!phoneNumber || typeof phoneNumber !== "string") {
        return phoneNumber;
    }

    // Clean the number
    const cleaned = phoneNumber.replace(/[\s\-()]/g, "");

    // If it already starts with +, return as is
    if (cleaned.startsWith("+")) {
        return cleaned;
    }

    // If country code is provided and number doesn't start with it, add it
    if (countryCode && !cleaned.startsWith(countryCode)) {
        return `+${countryCode}${cleaned}`;
    }

    return cleaned;
}
