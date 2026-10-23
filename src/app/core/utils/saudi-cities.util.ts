/**
 * Saudi Arabia Major Cities Definition & Recognition Utility
 * 
 * Provides an authoritative list of major cities in the Kingdom of Saudi Arabia (KSA)
 * and robust matching routines to detect Saudi cities across transliterations,
 * prefixes (e.g. Al-, Ar-, At-), and common alternate spellings.
 */

export interface SaudiCityInfo {
  canonicalName: string;
  arabicName: string;
  region: string;
}

export const SAUDI_CITIES_REGISTRY: SaudiCityInfo[] = [
  { canonicalName: 'Riyadh', arabicName: 'الرياض', region: 'Riyadh Province (Capital)' },
  { canonicalName: 'Jeddah', arabicName: 'جدة', region: 'Makkah Province' },
  { canonicalName: 'Mecca', arabicName: 'مكة المكرمة', region: 'Makkah Province' },
  { canonicalName: 'Medina', arabicName: 'المدينة المنورة', region: 'Madinah Province' },
  { canonicalName: 'Dammam', arabicName: 'الدمام', region: 'Eastern Province' },
  { canonicalName: 'Khobar', arabicName: 'الخبر', region: 'Eastern Province' },
  { canonicalName: 'Dhahran', arabicName: 'الظهران', region: 'Eastern Province' },
  { canonicalName: 'Tabuk', arabicName: 'تبوك', region: 'Tabuk Province' },
  { canonicalName: 'Taif', arabicName: 'الطائف', region: 'Makkah Province' },
  { canonicalName: 'Buraidah', arabicName: 'بريدة', region: 'Al-Qassim Province' },
  { canonicalName: 'Jubail', arabicName: 'الجبيل', region: 'Eastern Province' },
  { canonicalName: 'Abha', arabicName: 'أبها', region: 'Asir Province' },
  { canonicalName: 'Khamis Mushait', arabicName: 'خميس مشيط', region: 'Asir Province' },
  { canonicalName: 'Hofuf', arabicName: 'الهفوف', region: 'Eastern Province (Al-Ahsa)' },
  { canonicalName: 'Al-Ahsa', arabicName: 'الأحساء', region: 'Eastern Province' },
  { canonicalName: 'Hail', arabicName: 'حائل', region: 'Hail Province' },
  { canonicalName: 'Najran', arabicName: 'نجران', region: 'Najran Province' },
  { canonicalName: 'Jazan', arabicName: 'جازان', region: 'Jazan Province' },
  { canonicalName: 'Yanbu', arabicName: 'ينبع', region: 'Madinah Province' },
  { canonicalName: 'Qatif', arabicName: 'القطيف', region: 'Eastern Province' },
  { canonicalName: 'Unaizah', arabicName: 'عنيزة', region: 'Al-Qassim Province' },
  { canonicalName: 'Al Kharj', arabicName: 'الخرج', region: 'Riyadh Province' },
  { canonicalName: 'Al Bahah', arabicName: 'الباحة', region: 'Al Bahah Province' },
  { canonicalName: 'Sakaka', arabicName: 'سكاكا', region: 'Al Jawf Province' },
  { canonicalName: 'Arar', arabicName: 'عرعر', region: 'Northern Borders Province' },
  { canonicalName: 'NEOM', arabicName: 'نيوم', region: 'Tabuk Province' },
  { canonicalName: 'King Abdullah Economic City', arabicName: 'مدينة الملك عبدالله الاقتصادية', region: 'Makkah Province' },
  { canonicalName: 'Ras Tanura', arabicName: 'رأس تنورة', region: 'Eastern Province' },
  { canonicalName: 'Zulfi', arabicName: 'الزلفي', region: 'Riyadh Province' },
  { canonicalName: 'Bisha', arabicName: 'بيشة', region: 'Asir Province' },
  { canonicalName: 'Sharurah', arabicName: 'شرورة', region: 'Najran Province' },
  { canonicalName: 'Wadi Al Dawasir', arabicName: 'وادي الدواسر', region: 'Riyadh Province' }
];

/** Clean array of canonical city names for dropdown / datalist suggestions */
export const SAUDI_MAJOR_CITIES: string[] = SAUDI_CITIES_REGISTRY.map(c => c.canonicalName);

/**
 * Normalizes city string for lookup: lowercase, trims, removes punctuation,
 * and strips common Arabic article prefixes (al-, ar-, at-, ad-, az-, as-, ash-, an-).
 */
function normalizeCityKey(val: string): string {
  if (!val) return '';
  return val
    .toLowerCase()
    .trim()
    .replace(/['"`\-_.,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pre-computed mapping of all known variants to canonical city names */
const CITY_ALIASES_MAP: Record<string, string> = {};

function registerCity(canonical: string, aliases: string[]) {
  const normCanonical = normalizeCityKey(canonical);
  CITY_ALIASES_MAP[normCanonical] = canonical;

  for (const alias of aliases) {
    CITY_ALIASES_MAP[normalizeCityKey(alias)] = canonical;
    // Also register stripped version if starts with "al ", "ar ", "at ", "ad ", "az ", "as "
    const stripped = normalizeCityKey(alias).replace(/^(al|ar|at|ad|az|as|ash|an)\s+/, '');
    if (stripped && stripped.length > 2) {
      CITY_ALIASES_MAP[stripped] = canonical;
    }
  }
}

// 1. Riyadh
registerCity('Riyadh', [
  'riyadh', 'ar riyadh', 'ar-riyadh', 'al riyadh', 'riyad', 'الرياض'
]);

// 2. Jeddah
registerCity('Jeddah', [
  'jeddah', 'jiddah', 'jidda', 'jedda', 'جدة'
]);

// 3. Mecca / Makkah
registerCity('Mecca', [
  'mecca', 'makkah', 'makkah al mukarramah', 'mecca al mukarramah', 'macca', 'makkah almukarramah', 'مكة', 'مكة المكرمة'
]);

// 4. Medina / Madinah
registerCity('Medina', [
  'medina', 'madinah', 'al madinah', 'al-madinah', 'madinah al munawwarah', 'al madinah al munawwarah', 'المدينة', 'المدينة المنورة'
]);

// 5. Dammam
registerCity('Dammam', [
  'dammam', 'ad dammam', 'ad-dammam', 'al dammam', 'الدمام'
]);

// 6. Khobar
registerCity('Khobar', [
  'khobar', 'al khobar', 'al-khobar', 'alkhobar', 'al khobor', 'الخبر'
]);

// 7. Dhahran
registerCity('Dhahran', [
  'dhahran', 'az zahran', 'ad dhahran', 'al dhahran', 'aldhahran', 'الظهران'
]);

// 8. Tabuk
registerCity('Tabuk', [
  'tabuk', 'tabouk', 'تبوك'
]);

// 9. Taif
registerCity('Taif', [
  'taif', 'al taif', 'at taif', 'at-taif', 'altaif', 'attaif', 'الطائف'
]);

// 10. Buraidah
registerCity('Buraidah', [
  'buraidah', 'buraydah', 'buraida', 'al buraidah', 'بريدة'
]);

// 11. Jubail
registerCity('Jubail', [
  'jubail', 'al jubail', 'al-jubail', 'aljubail', 'jubail industrial city', 'الجبيل'
]);

// 12. Abha
registerCity('Abha', [
  'abha', 'أبها'
]);

// 13. Khamis Mushait
registerCity('Khamis Mushait', [
  'khamis mushait', 'khamis mushayt', 'khamis mushate', 'khamis', 'خميس مشيط'
]);

// 14. Hofuf & Al-Ahsa
registerCity('Hofuf', [
  'hofuf', 'al hofuf', 'al-hofuf', 'alhofuf', 'hufuf', 'الهفوف'
]);
registerCity('Al-Ahsa', [
  'al ahsa', 'al-ahsa', 'alahsa', 'al hasa', 'alhasa', 'al ahsaa', 'الأحساء'
]);

// 15. Hail
registerCity('Hail', [
  'hail', 'ha\'il', 'hayil', 'حائل'
]);

// 16. Najran
registerCity('Najran', [
  'najran', 'نجران'
]);

// 17. Jazan
registerCity('Jazan', [
  'jazan', 'jizan', 'gizan', 'جازان', 'جيزان'
]);

// 18. Yanbu
registerCity('Yanbu', [
  'yanbu', 'yanbu al bahr', 'yanbu industrial', 'ينبع'
]);

// 19. Qatif
registerCity('Qatif', [
  'qatif', 'al qatif', 'al-qatif', 'alqatif', 'القطيف'
]);

// 20. Unaizah
registerCity('Unaizah', [
  'unaizah', 'unayzah', 'onaizah', 'عنيزة'
]);

// 21. Al Kharj
registerCity('Al Kharj', [
  'al kharj', 'al-kharj', 'alkharj', 'kharj', 'الخرج'
]);

// 22. Al Bahah
registerCity('Al Bahah', [
  'al bahah', 'al-bahah', 'baha', 'al baha', 'albahah', 'albaha', 'الباحة'
]);

// 23. Sakaka
registerCity('Sakaka', [
  'sakaka', 'sakakah', 'سكاكا'
]);

// 24. Arar
registerCity('Arar', [
  'arar', '\'ar\'ar', 'عرعر'
]);

// 25. NEOM
registerCity('NEOM', [
  'neom', 'نيوم'
]);

// 26. King Abdullah Economic City
registerCity('King Abdullah Economic City', [
  'king abdullah economic city', 'kaec', 'مدينة الملك عبدالله الاقتصادية'
]);

// 27. Ras Tanura
registerCity('Ras Tanura', [
  'ras tanura', 'ras tanurah', 'rastanura', 'رأس تنورة'
]);

// 28. Zulfi
registerCity('Zulfi', [
  'zulfi', 'al zulfi', 'al-zulfi', 'alzulfi', 'الزلفي'
]);

// 29. Bisha
registerCity('Bisha', [
  'bisha', 'bishah', 'بيشة'
]);

// 30. Sharurah
registerCity('Sharurah', [
  'sharurah', 'sharorah', 'شرورة'
]);

// 31. Wadi Al Dawasir
registerCity('Wadi Al Dawasir', [
  'wadi al dawasir', 'wadi al-dawasir', 'wadi addawasir', 'وادي الدواسر'
]);

/**
 * Checks if the given city name matches a recognized major city of Saudi Arabia.
 *
 * @param city City name input string (e.g. "Riyadh", "al khobar", "Jeddah", "makkah")
 * @returns boolean true if recognized as a Saudi city, false otherwise.
 */
export function isSaudiCity(city: string | null | undefined): boolean {
  if (!city) return false;
  const normalized = normalizeCityKey(city);
  if (!normalized) return false;

  // Direct alias check
  if (CITY_ALIASES_MAP[normalized]) {
    return true;
  }

  // Strip prefix (al, ar, at, ad, etc.) check
  const stripped = normalized.replace(/^(al|ar|at|ad|az|as|ash|an)\s+/, '');
  if (stripped && CITY_ALIASES_MAP[stripped]) {
    return true;
  }

  // Partial/compound check if starts with a recognized city (e.g. "Riyadh, Central")
  for (const key of Object.keys(CITY_ALIASES_MAP)) {
    if (key.length >= 4 && (normalized === key || normalized.startsWith(key + ' ') || normalized.endsWith(' ' + key))) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the canonical Saudi city name if matched, or null if not a recognized Saudi city.
 */
export function getCanonicalSaudiCity(city: string | null | undefined): string | null {
  if (!city) return null;
  const normalized = normalizeCityKey(city);
  if (!normalized) return null;

  if (CITY_ALIASES_MAP[normalized]) {
    return CITY_ALIASES_MAP[normalized];
  }

  const stripped = normalized.replace(/^(al|ar|at|ad|az|as|ash|an)\s+/, '');
  if (stripped && CITY_ALIASES_MAP[stripped]) {
    return CITY_ALIASES_MAP[stripped];
  }

  for (const [key, canonical] of Object.entries(CITY_ALIASES_MAP)) {
    if (key.length >= 4 && (normalized === key || normalized.startsWith(key + ' ') || normalized.endsWith(' ' + key))) {
      return canonical;
    }
  }

  return null;
}
