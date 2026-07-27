/**
 * Timezone labels mapping IANA timezone identifiers to user-friendly display names
 * This file provides display names for timezone selectors in the UI
 * The database now stores IANA identifiers directly (e.g., "America/New_York")
 */

export const TimeZoneLabels: Record<string, string> = {
    // UTC-12 to UTC-01
    "Etc/GMT+12": "(UTC-12:00) International Date Line West",
    "Etc/GMT+11": "(UTC-11:00) Coordinated Universal Time-11",
    "Pacific/Honolulu": "(UTC-10:00) Hawaii",
    "America/Anchorage": "(UTC-09:00) Alaska",
    "America/Los_Angeles": "(UTC-08:00) Pacific Time (US & Canada)",
    "America/Phoenix": "(UTC-07:00) Arizona",
    "America/Mazatlan": "(UTC-07:00) Chihuahua, La Paz, Mazatlan",
    "America/Denver": "(UTC-07:00) Mountain Time (US & Canada)",
    "America/Guatemala": "(UTC-06:00) Central America",
    "America/Chicago": "(UTC-06:00) Central Time (US & Canada)",
    "America/Mexico_City": "(UTC-06:00) Guadalajara, Mexico City, Monterrey",
    "America/Regina": "(UTC-06:00) Saskatchewan",
    "America/Bogota": "(UTC-05:00) Bogota, Lima, Quito, Rio Branco",
    "America/New_York": "(UTC-05:00) Eastern Time (US & Canada)",
    "America/Indiana/Indianapolis": "(UTC-05:00) Indiana (East)",
    "America/Caracas": "(UTC-04:30) Caracas",
    "America/Asuncion": "(UTC-04:00) Asuncion",
    "America/Halifax": "(UTC-04:00) Atlantic Time (Canada)",
    "America/Cuiaba": "(UTC-04:00) Cuiaba",
    "America/La_Paz": "(UTC-04:00) Georgetown, La Paz, Manaus, San Juan",
    "America/Santiago": "(UTC-04:00) Santiago",
    "America/St_Johns": "(UTC-03:30) Newfoundland",
    "America/Sao_Paulo": "(UTC-03:00) Brasilia",
    "America/Argentina/Buenos_Aires": "(UTC-03:00) Buenos Aires",
    "America/Cayenne": "(UTC-03:00) Cayenne, Fortaleza",
    "America/Godthab": "(UTC-03:00) Greenland",
    "America/Montevideo": "(UTC-03:00) Montevideo",
    "America/Bahia": "(UTC-03:00) Salvador",
    "Etc/GMT+2": "(UTC-02:00) Coordinated Universal Time-02",
    "Atlantic/Azores": "(UTC-01:00) Azores",
    "Atlantic/Cape_Verde": "(UTC-01:00) Cape Verde Is.",

    // UTC+00
    "Africa/Casablanca": "(UTC+00:00) Casablanca",
    "UTC": "(UTC+00:00) Coordinated Universal Time",
    "Europe/London": "(UTC+00:00) Dublin, Edinburgh, Lisbon, London",
    "Atlantic/Reykjavik": "(UTC+00:00) Monrovia, Reykjavik",

    // UTC+01
    "Europe/Berlin": "(UTC+01:00) Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna",
    "Europe/Budapest": "(UTC+01:00) Belgrade, Bratislava, Budapest, Ljubljana, Prague",
    "Europe/Paris": "(UTC+01:00) Brussels, Copenhagen, Madrid, Paris",
    "Europe/Warsaw": "(UTC+01:00) Sarajevo, Skopje, Warsaw, Zagreb",
    "Africa/Lagos": "(UTC+01:00) West Central Africa",

    // UTC+02
    "Asia/Amman": "(UTC+02:00) Amman",
    "Europe/Athens": "(UTC+02:00) Athens, Bucharest, Istanbul",
    "Asia/Beirut": "(UTC+02:00) Beirut",
    "Africa/Cairo": "(UTC+02:00) Cairo",
    "Asia/Damascus": "(UTC+02:00) Damascus",
    "Africa/Johannesburg": "(UTC+02:00) Harare, Pretoria",
    "Europe/Helsinki": "(UTC+02:00) Helsinki, Kyiv, Riga, Sofia, Tallinn, Vilnius",
    "Asia/Jerusalem": "(UTC+02:00) Jerusalem",
    "Africa/Tripoli": "(UTC+02:00) Tripoli",
    "Africa/Windhoek": "(UTC+02:00) Windhoek",

    // UTC+03
    "Asia/Baghdad": "(UTC+03:00) Baghdad",
    "Europe/Istanbul": "(UTC+03:00) Istanbul",
    "Asia/Riyadh": "(UTC+03:00) Kuwait, Riyadh",
    "Europe/Minsk": "(UTC+03:00) Minsk",
    "Europe/Moscow": "(UTC+03:00) Moscow, St. Petersburg, Volgograd",
    "Asia/Tehran": "(UTC+03:30) Tehran",

    // UTC+04
    "Asia/Dubai": "(UTC+04:00) Abu Dhabi, Muscat",
    "Asia/Baku": "(UTC+04:00) Baku",
    "Indian/Mauritius": "(UTC+04:00) Port Louis",
    "Asia/Tbilisi": "(UTC+04:00) Tbilisi",
    "Asia/Yerevan": "(UTC+04:00) Yerevan",
    "Asia/Kabul": "(UTC+04:30) Kabul",

    // UTC+05
    "Asia/Yekaterinburg": "(UTC+05:00) Ekaterinburg",
    "Asia/Karachi": "(UTC+05:00) Islamabad, Karachi",
    "Asia/Kolkata": "(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi",
    "Asia/Colombo": "(UTC+05:30) Sri Jayawardenepura",
    "Asia/Kathmandu": "(UTC+05:45) Kathmandu",

    // UTC+06
    "Asia/Almaty": "(UTC+06:00) Astana",
    "Asia/Dhaka": "(UTC+06:00) Dhaka",
    "Asia/Novosibirsk": "(UTC+06:00) Novosibirsk",
    "Asia/Yangon": "(UTC+06:30) Yangon (Rangoon)",

    // UTC+07
    "Asia/Bangkok": "(UTC+07:00) Bangkok, Hanoi, Jakarta",
    "Asia/Krasnoyarsk": "(UTC+07:00) Krasnoyarsk",

    // UTC+08
    "Asia/Shanghai": "(UTC+08:00) Beijing, Chongqing, Hong Kong, Urumqi",
    "Asia/Irkutsk": "(UTC+08:00) Irkutsk",
    "Asia/Singapore": "(UTC+08:00) Kuala Lumpur, Singapore",
    "Australia/Perth": "(UTC+08:00) Perth",
    "Asia/Taipei": "(UTC+08:00) Taipei",
    "Asia/Ulaanbaatar": "(UTC+08:00) Ulaanbaatar",

    // UTC+09
    "Asia/Tokyo": "(UTC+09:00) Osaka, Sapporo, Tokyo",
    "Asia/Seoul": "(UTC+09:00) Seoul",
    "Asia/Yakutsk": "(UTC+09:00) Yakutsk",
    "Australia/Adelaide": "(UTC+09:30) Adelaide",
    "Australia/Darwin": "(UTC+09:30) Darwin",

    // UTC+10
    "Australia/Brisbane": "(UTC+10:00) Brisbane",
    "Australia/Sydney": "(UTC+10:00) Canberra, Melbourne, Sydney",
    "Pacific/Guam": "(UTC+10:00) Guam, Port Moresby",
    "Australia/Hobart": "(UTC+10:00) Hobart",
    "Asia/Vladivostok": "(UTC+10:00) Vladivostok",

    // UTC+11
    "Pacific/Guadalcanal": "(UTC+11:00) Magadan, Solomon Is., New Caledonia",

    // UTC+12
    "Pacific/Auckland": "(UTC+12:00) Auckland, Wellington",
    "Etc/GMT-12": "(UTC+12:00) Coordinated Universal Time+12",
    "Pacific/Fiji": "(UTC+12:00) Fiji",
    "Asia/Kamchatka": "(UTC+12:00) Petropavlovsk-Kamchatsky",

    // UTC+13 and UTC+14
    "Pacific/Tongatapu": "(UTC+13:00) Nuku'alofa",
    "Pacific/Apia": "(UTC+13:00) Samoa",
    "Pacific/Kiritimati": "(UTC+14:00) Kiritimati Island",
};
