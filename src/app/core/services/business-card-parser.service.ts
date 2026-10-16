import { Injectable } from '@angular/core';
import { BusinessCardScanResult } from '../models/ocr.model';

@Injectable({
  providedIn: 'root'
})
export class BusinessCardParserService {
  // Regex patterns
  private readonly EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  // Website regex: matches https://, http://, www., or bare domain names with common TLDs
  private readonly URL_REGEX = /\b(?:https?:\/\/|www\.)[^\s,;"'<>()]+|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+(?:com|org|net|edu|gov|io|ai|co|in|me|biz|info|store|tech|dev|app|global|ae|uk|ca|de|fr|jp|sa)(?::\d+)?(?:\/[^\s,;"'<>()]*)?/gi;

  // Phone candidate pattern: matches phone strings with optional country code, area code, spaces, hyphens
  private readonly PHONE_CANDIDATE_REGEX = /(?:\+\d{1,4}[-.\s]*)?(?:\(?\d{1,5}\)?[-.\s]*)?\d{3,5}[-.\s]*\d{3,5}(?:[-.\s]*(?:ext|x|extension)[-.\s]*\d{1,5})?/gi;

  // Phone type indicators
  private readonly MOBILE_LABEL_REGEX = /\b(?:m|mob|mobile|cell|c)\b[:.\-\s]?/i;
  private readonly LANDLINE_LABEL_REGEX = /\b(?:t|tel|telephone|phone|ph|office|off|direct|dir|landline)\b[:.\-\s]?/i;
  private readonly FAX_LABEL_REGEX = /\b(?:f|fax|facsimile)\b[:.\-\s]?/i;

  // Non-phone cue blacklist: labels like "Reg No:", "VAT:", "Postal Code:", "Zip:"
  private readonly NON_PHONE_LINE_REGEX = /\b(?:reg|registration|reg\.?\s*no|vat|tin|cin|gst|gstin|postal|post\s*code|zip|zipcode|pincode|pin|cr|tax|license|licence|date|iso)\b[:.\-\s]?/i;

  // Expanded and realistic designations list
  private readonly COMMON_DESIGNATIONS = [
    'chief executive officer', 'ceo', 'chief technology officer', 'cto',
    'chief operating officer', 'coo', 'chief financial officer', 'cfo',
    'chief marketing officer', 'cmo', 'chief information officer', 'cio',
    'managing director', 'executive director', 'director', 'general manager', 'gm',
    'deputy general manager', 'assistant manager', 'branch manager', 'manager',
    'vice president', 'senior vice president', 'executive vice president', 'svp', 'evp', 'avp', 'vp',
    'president', 'founder', 'co-founder', 'proprietor', 'owner', 'partner',
    'managing partner', 'principal', 'executive', 'supervisor', 'team lead', 'lead',
    'head of technology', 'head of engineering', 'head of sales', 'head of marketing',
    'head of operations', 'head of hr', 'head of finance', 'head of business development',
    'software engineer', 'senior software engineer', 'sr. software engineer', 'sr software engineer',
    'lead software engineer', 'principal engineer', 'systems engineer', 'devops engineer',
    'full stack developer', 'backend developer', 'frontend developer', 'developer',
    'senior engineer', 'lead engineer', 'engineer', 'architect', 'solutions architect',
    'business development manager', 'bdm', 'business development executive', 'bde',
    'sales manager', 'sales executive', 'sales representative', 'sales director',
    'sales department', 'marketing department', 'engineering department',
    'finance department', 'operations department', 'business development department',
    'commercial department', 'export department', 'customer service department',
    'customer service', 'technical support', 'head of department', 'sales team',
    'marketing manager', 'marketing executive', 'marketing director', 'digital marketing specialist',
    'account manager', 'senior account manager', 'key account manager', 'account executive',
    'project manager', 'pmp', 'program manager', 'product manager', 'scrum master',
    'consultant', 'senior consultant', 'principal consultant', 'adviser', 'advisor',
    'creative director', 'art director', 'ui/ux designer', 'graphic designer',
    'operations manager', 'operations director', 'administrator', 'office manager',
    'chartered accountant', 'ca', 'auditor', 'legal counsel', 'advocate', 'attorney'
  ];

  // Company Legal Forms & Entity Suffixes
  private readonly COMPANY_SUFFIXES = [
    'inc', 'inc.', 'llc', 'llc.', 'ltd', 'ltd.', 'corp', 'corp.', 'corporation',
    'technologies', 'technology', 'solutions', 'systems', 'group', 'holdings',
    'enterprises', 'industries', 'services', 'consulting', 'consultancy',
    'global', 'international', 'pvt ltd', 'pvt. ltd.', 'private limited',
    'co.', 'company', 'studios', 'labs', 'ventures', 'llp', 'plc', 'gmbh',
    'sa', 'bv', 'pty', 'fzc', 'fze', 'est.', 'establishment', 'agency',
    'works', 'associates', 'partners', 'logistics', 'pharmaceuticals', 'health',
    'infotech', 'software', 'media', 'communications', 'network', 'digital'
  ];

  // Countries & Normalization Map
  private readonly COUNTRY_MAP: Record<string, string> = {
    'usa': 'United States',
    'us': 'United States',
    'united states': 'United States',
    'united states of america': 'United States',
    'uk': 'United Kingdom',
    'united kingdom': 'United Kingdom',
    'great britain': 'United Kingdom',
    'england': 'United Kingdom',
    'uae': 'United Arab Emirates',
    'united arab emirates': 'United Arab Emirates',
    'india': 'India',
    'canada': 'Canada',
    'australia': 'Australia',
    'germany': 'Germany',
    'france': 'France',
    'singapore': 'Singapore',
    'japan': 'Japan',
    'netherlands': 'Netherlands',
    'switzerland': 'Switzerland',
    'saudi arabia': 'Saudi Arabia',
    'ksa': 'Saudi Arabia',
    'qatar': 'Qatar',
    'malaysia': 'Malaysia',
    'china': 'China',
    'spain': 'Spain',
    'italy': 'Italy',
    'brazil': 'Brazil',
    'south africa': 'South Africa',
    'new zealand': 'New Zealand',
    'ireland': 'Ireland',
    'sweden': 'Sweden',
    'norway': 'Norway',
    'denmark': 'Denmark',
    'finland': 'Finland',
    'kuwait': 'Kuwait',
    'oman': 'Oman',
    'bahrain': 'Bahrain'
  };

  // Known Major Global Cities for robust detection
  private readonly KNOWN_CITIES = [
    'new york', 'los angeles', 'chicago', 'houston', 'san francisco', 'seattle', 'boston', 'austin',
    'london', 'manchester', 'birmingham', 'edinburgh', 'dublin',
    'dubai', 'abu dhabi', 'sharjah', 'riyadh', 'jeddah', 'doha',
    'chennai', 'mumbai', 'bangalore', 'bengaluru', 'delhi', 'new delhi', 'hyderabad', 'kolkata', 'pune', 'coimbatore',
    'singapore', 'tokyo', 'sydney', 'melbourne', 'toronto', 'vancouver', 'montreal',
    'paris', 'berlin', 'munich', 'frankfurt', 'amsterdam', 'zurich', 'geneva'
  ];

  // Address Keywords (includes address/addr labels, avoids bare 'dr' to prevent false collisions with 'Dr.')
  private readonly ADDRESS_KEYWORDS_REGEX = /\b(?:address|addr|street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|way|court|ct|plaza|square|sq|tower|towers|building|bldg|block|blk|suite|ste|floor|fl|level|po box|p\.o\. box|box|sector|phase|nagar|salai|marg|cross|industrial area|tech park|cyber city)\b/i;

  parse(rawText: string): BusinessCardScanResult {
    if (!rawText || !rawText.trim()) {
      return {
        confidenceScore: 0,
        rawText: rawText || '',
        lines: []
      };
    }

    const lines = rawText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const result: BusinessCardScanResult = {
      confidenceScore: 0,
      rawText: rawText,
      lines: lines
    };

    // Tracks line usage without strictly excluding multi-entity lines
    const lineUsage = new Map<number, Set<string>>();
    const markUsage = (idx: number, field: string) => {
      if (!lineUsage.has(idx)) {
        lineUsage.set(idx, new Set());
      }
      lineUsage.get(idx)!.add(field);
    };

    // ==========================================
    // 1. EXTRACT EMAILS
    // ==========================================
    const emails: string[] = [];
    lines.forEach((line, idx) => {
      const matches = line.match(this.EMAIL_REGEX);
      if (matches) {
        matches.forEach(rawEmail => {
          const cleanEmail = this.cleanEmail(rawEmail);
          if (cleanEmail && !emails.includes(cleanEmail)) {
            emails.push(cleanEmail);
            markUsage(idx, 'email');
          }
        });
      }
    });

    if (emails.length > 0) {
      result.email = emails[0];
      result.contactEmail = emails.length > 1 ? emails[1] : emails[0];
    }

    // Determine primary email domain (for company heuristic verification)
    let emailDomain = '';
    if (result.email) {
      const parts = result.email.split('@');
      if (parts.length === 2) {
        emailDomain = parts[1].toLowerCase();
      }
    }

    // ==========================================
    // 2. EXTRACT WEBSITES
    // ==========================================
    const websiteCandidates: { url: string; lineIdx: number }[] = [];
    lines.forEach((line, idx) => {
      // Avoid parsing email lines as standalone websites
      let textWithoutEmails = line;
      emails.forEach(e => {
        textWithoutEmails = textWithoutEmails.replace(e, ' ');
      });

      const matches = textWithoutEmails.match(this.URL_REGEX);
      if (matches) {
        matches.forEach(rawUrl => {
          const cleanUrl = this.cleanAndNormalizeUrl(rawUrl);
          if (cleanUrl && !websiteCandidates.some(c => c.url.toLowerCase() === cleanUrl.toLowerCase())) {
            websiteCandidates.push({ url: cleanUrl, lineIdx: idx });
            markUsage(idx, 'website');
          }
        });
      }
    });

    if (websiteCandidates.length > 0) {
      result.website = websiteCandidates[0].url;
    }

    // ==========================================
    // 3. EXTRACT PHONE NUMBERS (Mobile, Landline, Fax)
    // ==========================================
    const phoneCandidates = this.extractPhoneCandidates(lines, markUsage);
    if (phoneCandidates.length > 0) {
      const mobileCandidate = phoneCandidates.find(p => p.type === 'mobile');
      const landlineCandidate = phoneCandidates.find(p => p.type === 'landline');
      const genericCandidates = phoneCandidates.filter(p => p.type === 'generic');

      if (mobileCandidate) {
        result.contactMobileNumber = mobileCandidate.number;
        if (landlineCandidate) {
          result.landline = landlineCandidate.number;
        } else if (genericCandidates.length > 0) {
          result.landline = genericCandidates[0].number;
        }
      } else if (landlineCandidate) {
        result.landline = landlineCandidate.number;
        if (genericCandidates.length > 0) {
          result.contactMobileNumber = genericCandidates[0].number;
        }
      } else {
        // Only generic numbers available: assign first as mobile, second as landline
        result.contactMobileNumber = genericCandidates[0].number;
        if (genericCandidates.length > 1) {
          result.landline = genericCandidates[1].number;
        }
      }
    }

    // ==========================================
    // 4. EXTRACT DESIGNATION
    // ==========================================
    let designationLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (lineUsage.get(i)?.has('email') || lineUsage.get(i)?.has('website')) {
        continue;
      }
      const matchedDesig = this.findDesignation(line);
      if (matchedDesig) {
        result.contactDesignation = matchedDesig;
        designationLineIdx = i;
        markUsage(i, 'designation');
        break;
      }
    }

    // ==========================================
    // 5. EXTRACT CONTACT NAME
    // ==========================================
    // Priority A: Line adjacent to Designation
    if (designationLineIdx >= 0) {
      // Check line above designation
      if (designationLineIdx > 0 && this.isEligibleForPersonName(designationLineIdx - 1, lines, lineUsage)) {
        result.contactName = this.cleanPersonName(lines[designationLineIdx - 1]);
        markUsage(designationLineIdx - 1, 'name');
      }
      // Check line below designation if line above wasn't a valid name
      else if (designationLineIdx + 1 < lines.length && this.isEligibleForPersonName(designationLineIdx + 1, lines, lineUsage)) {
        result.contactName = this.cleanPersonName(lines[designationLineIdx + 1]);
        markUsage(designationLineIdx + 1, 'name');
      }
    }

    // Priority B: Top lines of the card if not found adjacent to designation
    if (!result.contactName) {
      const maxTopLines = Math.min(4, lines.length);
      for (let i = 0; i < maxTopLines; i++) {
        if (this.isEligibleForPersonName(i, lines, lineUsage)) {
          // Additional check: Ensure it's not a strong company candidate
          if (!this.hasCompanySuffix(lines[i])) {
            result.contactName = this.cleanPersonName(lines[i]);
            markUsage(i, 'name');
            break;
          }
        }
      }
    }

    // ==========================================
    // 6. EXTRACT COMPANY NAME
    // ==========================================
    // Priority A: Explicit Company Suffix
    for (let i = 0; i < lines.length; i++) {
      if (lineUsage.get(i)?.has('name') || lineUsage.get(i)?.has('designation') || lineUsage.get(i)?.has('email')) {
        continue;
      }
      if (this.hasCompanySuffix(lines[i])) {
        if (!this.isValidCompanyCandidate(lines[i])) continue;
        let fullCompany = lines[i];
        if (i + 1 < lines.length && !lineUsage.get(i + 1)?.has('name') && !lineUsage.get(i + 1)?.has('designation') && !lineUsage.get(i + 1)?.has('email')) {
          if (this.hasCompanySuffix(lines[i + 1]) && this.isValidCompanyCandidate(lines[i + 1])) {
            fullCompany += ' ' + lines[i + 1];
            markUsage(i + 1, 'company');
          }
        }
        result.companyName = this.cleanCompanyName(fullCompany);
        markUsage(i, 'company');
        break;
      }
    }

    // Priority B: Email / Website Domain Match (e.g. info@knotix.store -> "Knotix", www.canadiansystems.sa -> "Canadian Systems")
    if (!result.companyName) {
      let candidateDomain = '';
      if (emailDomain) {
        const publicEmailProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'zoho.com', 'proton.me', 'mail.com'];
        if (!publicEmailProviders.includes(emailDomain)) {
          candidateDomain = emailDomain.split('.')[0];
        }
      }
      if (!candidateDomain && result.website) {
        try {
          const host = result.website.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].split(':')[0];
          candidateDomain = host.split('.')[0];
        } catch {
          // ignore
        }
      }

      if (candidateDomain && candidateDomain.length >= 3) {
        const domainClean = candidateDomain.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (let i = 0; i < lines.length; i++) {
          if (lineUsage.get(i)?.has('name') || lineUsage.get(i)?.has('designation')) continue;
          const cleanLine = lines[i].trim();
          const lineCompact = cleanLine.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (lineCompact.includes(domainClean) || domainClean.includes(lineCompact)) {
            if (this.isValidCompanyCandidate(cleanLine)) {
              result.companyName = this.cleanCompanyName(cleanLine);
              markUsage(i, 'company');
              break;
            }
          }
        }
      }
    }

    // Priority C: Top Unclaimed Prominent Line
    if (!result.companyName) {
      for (let i = 0; i < Math.min(3, lines.length); i++) {
        if (!lineUsage.get(i)?.has('name') && !lineUsage.get(i)?.has('designation') && !lineUsage.get(i)?.has('email') && !lineUsage.get(i)?.has('website')) {
          const line = lines[i].trim();
          if (this.isValidCompanyCandidate(line)) {
            result.companyName = this.cleanCompanyName(line);
            markUsage(i, 'company');
            break;
          }
        }
      }
    }

    // ==========================================
    // 7. EXTRACT COUNTRY, CITY, AND ADDRESS
    // ==========================================
    this.extractLocation(lines, lineUsage, result);

    // ==========================================
    // 8. HEURISTIC CONFIDENCE SCORING (0 to 100)
    // ==========================================
    result.confidenceScore = this.calculateConfidenceScore(result);
    result.isLowConfidence = result.confidenceScore < 35;

    return result;
  }

  // ----------------------------------------------------
  // Private Helper Methods
  // ----------------------------------------------------

  private cleanEmail(rawEmail: string): string {
    let email = rawEmail.trim();
    // Trim leading/trailing punctuation commonly captured from OCR
    email = email.replace(/^[<([{"':]+|[>\])}"':,;.]+$/g, '').trim();
    return email.toLowerCase();
  }

  private cleanAndNormalizeUrl(rawUrl: string): string | null {
    let url = rawUrl.trim();
    // Strip trailing punctuation (periods, commas, closing brackets) but keep valid path characters
    url = url.replace(/[>\])}"':,;.]+$/g, '').trim();

    // Reject email addresses falsely matched
    if (url.includes('@')) return null;

    // Reject standalone numeric/short tokens
    if (url.length < 4 || !url.includes('.')) return null;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      const parsed = new URL(url);
      if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
      return url;
    } catch {
      return null;
    }
  }

  private extractPhoneCandidates(
    lines: string[],
    markUsage: (idx: number, field: string) => void
  ): { number: string; type: 'mobile' | 'landline' | 'generic' }[] {
    const results: { number: string; type: 'mobile' | 'landline' | 'generic' }[] = [];
    const seenDigits = new Set<string>();

    lines.forEach((line, idx) => {
      // Reject lines identified as registration/postal/tax numbers unless an explicit phone keyword exists
      const hasPhoneCue = this.MOBILE_LABEL_REGEX.test(line) || this.LANDLINE_LABEL_REGEX.test(line);
      if (this.NON_PHONE_LINE_REGEX.test(line) && !hasPhoneCue) {
        return;
      }

      // Check if line contains label followed by number
      const hasMobile = this.MOBILE_LABEL_REGEX.test(line);
      const hasLandline = this.LANDLINE_LABEL_REGEX.test(line);
      const hasFax = this.FAX_LABEL_REGEX.test(line);

      // Skip dedicated Fax lines unless no other numbers exist
      if (hasFax && !hasMobile && !hasLandline) return;

      // Extract after label if present, or search line
      let searchTarget = line;
      if (hasPhoneCue) {
        searchTarget = line.replace(/^[A-Za-z\s]+[:.\-]/, '').trim();
      }

      const matches = searchTarget.match(this.PHONE_CANDIDATE_REGEX);
      if (!matches) return;

      matches.forEach(rawMatch => {
        // Clean leading/trailing punctuation but preserve internal spaces, parentheses, hyphens, and leading +
        let cleanNumber = rawMatch.trim().replace(/^[^0-9+]+|[^0-9]+$/g, '');
        const digitsOnly = cleanNumber.replace(/\D/g, '');

        // Valid phone numbers are typically 7 to 15 digits
        if (digitsOnly.length < 7 || digitsOnly.length > 15) return;

        // Discard pure 6-digit postal zip codes
        if (digitsOnly.length <= 6) return;

        // Prevent duplicate numbers
        if (seenDigits.has(digitsOnly)) return;
        seenDigits.add(digitsOnly);

        let type: 'mobile' | 'landline' | 'generic' = 'generic';
        if (hasMobile) {
          type = 'mobile';
        } else if (hasLandline) {
          type = 'landline';
        }

        results.push({ number: cleanNumber, type });
        markUsage(idx, 'phone');
      });
    });

    return results;
  }

  private findDesignation(line: string): string | null {
    const trimmed = line.trim();
    if (trimmed.length < 2 || trimmed.length > 70) return null;
    if (/\d{4,}/.test(trimmed)) return null; // Reject lines with long numbers

    const lower = trimmed.toLowerCase();

    for (const desig of this.COMMON_DESIGNATIONS) {
      // Word-boundary match to avoid matching substrings inside unrelated words
      const regex = new RegExp(`(^|[^a-zA-Z])${this.escapeRegex(desig)}([^a-zA-Z]|$)`, 'i');
      if (regex.test(lower)) {
        return trimmed;
      }
    }
    return null;
  }

  private isEligibleForPersonName(
    idx: number,
    lines: string[],
    lineUsage: Map<number, Set<string>>
  ): boolean {
    const usage = lineUsage.get(idx);
    if (usage && (usage.has('email') || usage.has('website') || usage.has('phone') || usage.has('designation'))) {
      return false;
    }
    return this.isValidPersonName(lines[idx]);
  }

  private normalizePersonName(str: string): string {
    if (!str) return '';
    return str.trim().replace(/^((?:eng|dr|arch|prof|adv|mr|ms|mrs)\b\.?)\s*[/:\-]\s*/i, (_match, p1: string) => {
      return (p1.endsWith('.') ? p1 : p1 + '.') + ' ';
    });
  }

  private isValidPersonName(str: string): boolean {
    if (!str) return false;
    const clean = this.normalizePersonName(str);
    if (clean.length < 2 || clean.length > 55) return false;

    // Reject 2-3 letter all-uppercase acronyms/monograms (e.g. CS, ABC, IT, LLC)
    if (/^[A-Z]{1,3}$/.test(clean)) return false;

    // Disallow numbers
    if (/\d/.test(clean)) return false;

    // Disallow symbols that don't belong in names (allow apostrophes, hyphens, periods)
    if (/[@#$%^*()_+={}[\]:;"<>?\\|~]/.test(clean)) return false;

    // Reject obvious address keywords or website protocols (does not use ADDRESS_KEYWORDS_REGEX directly to preserve titles like Dr.)
    if (/\b(?:p\.?o\.?\s*box|suite|floor|road|street|avenue|boulevard|highway|industrial area)\b/i.test(clean) ||
        /\b(?:http|www|com|email|tel|mob|fax)\b/i.test(clean)) {
      return false;
    }

    // Reject if line is an exact designation
    if (this.findDesignation(clean)) return false;

    // Accept single-word names (e.g. "Cher", "Plato"), or multi-word names with prefixes, initials, apostrophes, hyphens
    const words = clean.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 1 || words.length > 6) return false;

    // Every word must look like a valid name component (supports titles like Dr., initials like J., and hyphens/apostrophes like O'Connor-Smith)
    const namePartRegex = /^[A-Za-zÀ-ÿ]+(?:['\-][A-Za-zÀ-ÿ]+)*\.?$/;
    return words.every(w => namePartRegex.test(w));
  }

  private cleanPersonName(rawName: string): string {
    const normalized = this.normalizePersonName(rawName);
    return normalized.trim().replace(/^[^A-Za-z]+|[^A-Za-z.]+$/g, '').trim();
  }

  private hasCompanySuffix(line: string): boolean {
    const lower = line.toLowerCase();
    return this.COMPANY_SUFFIXES.some(suffix => {
      const regex = new RegExp(`(^|[^a-zA-Z])${this.escapeRegex(suffix)}([^a-zA-Z]|$)`, 'i');
      return regex.test(lower);
    });
  }

  private isValidCompanyCandidate(line: string): boolean {
    if (!line) return false;
    const clean = line.trim();
    if (clean.length < 2 || clean.length > 70) return false;
    if (/\d{4,}/.test(clean)) return false; // Reject phone or registration numbers
    if (clean.includes('@')) return false;

    // Reject lines that are address components
    if (this.ADDRESS_KEYWORDS_REGEX.test(clean)) return false;

    // Reject corporate slogans/taglines (e.g. "Pioneers in...", "Leading...")
    if (/^(?:pioneers?|leaders?|specialists?|excellence|your partner|delivering|empowering|innovating)\s+in\b/i.test(clean)) {
      return false;
    }

    // Reject document title phrases like "Report", "Summary"
    if (/\b(?:report|summary|statement|invoice|receipt|contract|agreement)\b/i.test(clean)) return false;

    // Reject if it is a pure country or person name
    if (this.COUNTRY_MAP[clean.toLowerCase()]) return false;

    return true;
  }

  private cleanCompanyName(rawCompany: string): string {
    return rawCompany.trim().replace(/^[^\w]+|[^\w.]+$/g, '').trim();
  }

  private extractLocation(
    lines: string[],
    lineUsage: Map<number, Set<string>>,
    result: BusinessCardScanResult
  ): void {
    const addressCandidates: string[] = [];

    // Phase 1: Detect Country and Known Cities across eligible lines
    lines.forEach((line, idx) => {
      const usage = lineUsage.get(idx);
      // Skip lines purely consumed by person name, designation, email, or website
      if (usage && (usage.has('name') || usage.has('designation') || usage.has('email') || usage.has('website') || usage.has('company'))) {
        return;
      }

      const lower = line.toLowerCase();

      // 1. Check for Country match using word boundaries
      for (const [key, normalizedCountry] of Object.entries(this.COUNTRY_MAP)) {
        const regex = new RegExp(`(^|[^a-zA-Z])${this.escapeRegex(key)}([^a-zA-Z]|$)`, 'i');
        if (regex.test(lower)) {
          result.country = normalizedCountry;
          break;
        }
      }

      // 2. Check for Known Cities
      if (!result.city) {
        for (const city of this.KNOWN_CITIES) {
          const regex = new RegExp(`(^|[^a-zA-Z])${this.escapeRegex(city)}([^a-zA-Z]|$)`, 'i');
          if (regex.test(lower)) {
            result.city = this.capitalizeWords(city);
            break;
          }
        }
      }
    });

    // Fallback City extraction from comma-separated location line: e.g. "Chennai, Tamil Nadu, India"
    if (!result.city) {
      for (const line of lines) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          const firstPartClean = parts[0].replace(/\d+/g, '').trim();
          if (firstPartClean.length >= 3 && firstPartClean.length <= 25 && !this.ADDRESS_KEYWORDS_REGEX.test(firstPartClean)) {
            result.city = this.capitalizeWords(firstPartClean);
            break;
          }
        }
      }
    }

    // Phase 2: Collect Street Address lines
    lines.forEach((line, idx) => {
      const usage = lineUsage.get(idx);
      if (usage && (usage.has('name') || usage.has('designation') || usage.has('email') || usage.has('website') || usage.has('company'))) {
        return;
      }

      const isAddressLine = this.ADDRESS_KEYWORDS_REGEX.test(line) ||
        /\b\d{1,5}\s+[A-Za-z]/.test(line) ||
        /\b(?:floor|fl|suite|ste|po box|p\.o\. box|address|addr)\b/i.test(line);

      if (isAddressLine && !usage?.has('phone')) {
        let cleanAddr = line.replace(/^[^\w]*\b(?:address|addr)\b\s*[:.\-]\s*/i, '').trim();

        // If the line consists ONLY of the city and/or country (e.g. "Riyadh- ksa"), do NOT put it in Street Address
        if (this.isOnlyCityOrCountry(cleanAddr, result.city, result.country)) {
          return;
        }

        if (cleanAddr && cleanAddr.length >= 3) {
          addressCandidates.push(cleanAddr);
        }
      }
    });

    if (addressCandidates.length > 0) {
      result.address = addressCandidates.join(', ');
    }
  }

  private isOnlyCityOrCountry(str: string, city?: string, country?: string): boolean {
    if (!str) return true;
    let remaining = str.trim();

    if (city) {
      const cityRegex = new RegExp(`(^|[^a-zA-Z])${this.escapeRegex(city)}([^a-zA-Z]|$)`, 'gi');
      remaining = remaining.replace(cityRegex, '$1$2').trim();
    }

    if (country) {
      const countryRegex = new RegExp(`(^|[^a-zA-Z])${this.escapeRegex(country)}([^a-zA-Z]|$)`, 'gi');
      remaining = remaining.replace(countryRegex, '$1$2').trim();

      // Also strip country keys/aliases (e.g. ksa, uae, us, uk)
      for (const [key, val] of Object.entries(this.COUNTRY_MAP)) {
        if (val.toLowerCase() === country.toLowerCase()) {
          const aliasRegex = new RegExp(`(^|[^a-zA-Z])${this.escapeRegex(key)}([^a-zA-Z]|$)`, 'gi');
          remaining = remaining.replace(aliasRegex, '$1$2').trim();
        }
      }
    }

    // Strip separators, hyphens, and whitespace
    remaining = remaining.replace(/[,;:\-\/\s]+/g, '').trim();

    // If no meaningful text remains, it was only composed of city and country
    return remaining.length === 0;
  }

  private calculateConfidenceScore(result: BusinessCardScanResult): number {
    let score = 0;

    // Contactability: Email (25) & Phone (25)
    if (result.email) score += 25;
    if (result.contactMobileNumber) {
      score += 20;
    } else if (result.landline) {
      score += 15;
    }

    // Entity details: Company (20) - only awarded if there are supporting contact credentials
    const hasContactCues = !!(result.email || result.contactMobileNumber || result.landline);
    if (result.companyName && hasContactCues) {
      score += 20;
    }

    // Personal details: Name (15) & Designation (10)
    if (result.contactName) score += 15;
    if (result.contactDesignation) score += 10;

    // Location / Web evidence (max 10)
    let locationScore = 0;
    if (result.website) locationScore += 5;
    if (result.address || result.city || result.country) locationScore += 5;
    score += locationScore;

    // Sanity check: If there is no phone, no email, and no person name, it's not a recognizable business card
    if (!result.email && !result.contactMobileNumber && !result.landline && !result.contactName) {
      score = 0;
    }

    return Math.min(100, Math.max(0, score));
  }

  private capitalizeWords(str: string): string {
    return str
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
