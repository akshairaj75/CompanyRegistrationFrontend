export interface CountryOption {
  code: string;
  name: string;
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'USA', name: 'United States' },
  { code: 'KSA', name: 'Saudi Arabia' },
  { code: 'IND', name: 'India' },
  { code: 'UAE', name: 'United Arab Emirates' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'CAN', name: 'Canada' },
  { code: 'AUS', name: 'Australia' },
  { code: 'DEU', name: 'Germany' },
  { code: 'FRA', name: 'France' },
  { code: 'SGP', name: 'Singapore' },
  { code: 'JPN', name: 'Japan' },
  { code: 'NLD', name: 'Netherlands' },
  { code: 'CHE', name: 'Switzerland' },
  { code: 'QAT', name: 'Qatar' },
  { code: 'KWT', name: 'Kuwait' },
  { code: 'OMN', name: 'Oman' },
  { code: 'BHR', name: 'Bahrain' },
  { code: 'MYS', name: 'Malaysia' },
  { code: 'CHN', name: 'China' },
  { code: 'ESP', name: 'Spain' },
  { code: 'ITA', name: 'Italy' },
  { code: 'BRA', name: 'Brazil' },
  { code: 'ZAF', name: 'South Africa' },
  { code: 'NZL', name: 'New Zealand' },
  { code: 'IRL', name: 'Ireland' },
  { code: 'SWE', name: 'Sweden' },
  { code: 'NOR', name: 'Norway' },
  { code: 'DNK', name: 'Denmark' },
  { code: 'FIN', name: 'Finland' },
  { code: 'OTHER', name: 'Other' }
];

const CODE_BY_NAME_OR_ALIAS: Record<string, string> = {
  // USA
  'usa': 'USA',
  'us': 'USA',
  'united states': 'USA',
  'united states of america': 'USA',
  'u.s.a.': 'USA',
  'u.s.': 'USA',

  // KSA
  'ksa': 'KSA',
  'saudi arabia': 'KSA',
  'saudi': 'KSA',
  'kingdom of saudi arabia': 'KSA',
  'k.s.a.': 'KSA',

  // IND
  'ind': 'IND',
  'india': 'IND',
  'in': 'IND',
  'bharat': 'IND',

  // UAE
  'uae': 'UAE',
  'united arab emirates': 'UAE',
  'emirates': 'UAE',
  'dubai': 'UAE',
  'abu dhabi': 'UAE',
  'sharjah': 'UAE',
  'u.a.e.': 'UAE',

  // UK
  'uk': 'UK',
  'united kingdom': 'UK',
  'great britain': 'UK',
  'britain': 'UK',
  'england': 'UK',
  'gb': 'UK',
  'gbr': 'UK',

  // CAN
  'can': 'CAN',
  'canada': 'CAN',

  // AUS
  'aus': 'AUS',
  'australia': 'AUS',

  // DEU
  'deu': 'DEU',
  'germany': 'DEU',
  'ger': 'DEU',
  'deutschland': 'DEU',

  // FRA
  'fra': 'FRA',
  'france': 'FRA',

  // SGP
  'sgp': 'SGP',
  'singapore': 'SGP',

  // JPN
  'jpn': 'JPN',
  'japan': 'JPN',

  // NLD
  'nld': 'NLD',
  'netherlands': 'NLD',
  'holland': 'NLD',

  // CHE
  'che': 'CHE',
  'switzerland': 'CHE',

  // QAT
  'qat': 'QAT',
  'qatar': 'QAT',

  // KWT
  'kwt': 'KWT',
  'kuwait': 'KWT',

  // OMN
  'omn': 'OMN',
  'oman': 'OMN',

  // BHR
  'bhr': 'BHR',
  'bahrain': 'BHR',

  // MYS
  'mys': 'MYS',
  'malaysia': 'MYS',

  // CHN
  'chn': 'CHN',
  'china': 'CHN',

  // ESP
  'esp': 'ESP',
  'spain': 'ESP',

  // ITA
  'ita': 'ITA',
  'italy': 'ITA',

  // BRA
  'bra': 'BRA',
  'brazil': 'BRA',

  // ZAF
  'zaf': 'ZAF',
  'south africa': 'ZAF',

  // NZL
  'nzl': 'NZL',
  'new zealand': 'NZL',

  // IRL
  'irl': 'IRL',
  'ireland': 'IRL',

  // SWE
  'swe': 'SWE',
  'sweden': 'SWE',

  // NOR
  'nor': 'NOR',
  'norway': 'NOR',

  // DNK
  'dnk': 'DNK',
  'denmark': 'DNK',

  // FIN
  'fin': 'FIN',
  'finland': 'FIN',

  'other': 'OTHER'
};

/**
 * Normalizes any country representation (full name, alias, lowercase code, etc.)
 * into a standardized uppercase short code (e.g. 'USA', 'KSA', 'IND').
 */
export function normalizeToCountryCode(value?: string | null): string {
  if (!value) return '';
  const clean = value.trim();
  const lower = clean.toLowerCase();

  // If already mapped
  if (CODE_BY_NAME_OR_ALIAS[lower]) {
    return CODE_BY_NAME_OR_ALIAS[lower];
  }

  // Check if it directly matches a registered code
  const matched = COUNTRY_OPTIONS.find(o => o.code.toLowerCase() === lower);
  if (matched) {
    return matched.code;
  }

  // Return clean uppercase if 3 letters or less, otherwise keep or fallback
  return clean.length <= 4 ? clean.toUpperCase() : clean;
}
