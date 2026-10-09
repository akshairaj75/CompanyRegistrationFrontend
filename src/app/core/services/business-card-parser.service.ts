import { Injectable } from '@angular/core';
import { BusinessCardScanResult } from '../models/ocr.model';

@Injectable({
  providedIn: 'root'
})
export class BusinessCardParserService {
  private readonly EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  private readonly URL_REGEX = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/i;
  private readonly PHONE_REGEX = /(?:(?:\+|00)\d{1,4}[-.\s]*)?(?:\(?\d{2,5}\)?[-.\s]*)?\d{3,4}[-.\s]*\d{3,4}/g;

  private readonly COMMON_DESIGNATIONS = [
    'chief executive officer', 'ceo', 'chief technology officer', 'cto',
    'chief operating officer', 'coo', 'chief financial officer', 'cfo',
    'managing director', 'director', 'general manager', 'manager',
    'vice president', 'vp', 'president', 'founder', 'co-founder',
    'owner', 'partner', 'principal', 'executive', 'supervisor',
    'lead engineer', 'software engineer', 'senior engineer', 'engineer',
    'marketing manager', 'sales manager', 'account manager', 'business development',
    'project manager', 'product manager', 'consultant', 'senior consultant',
    'head of sales', 'head of operations', 'operations manager', 'creative director'
  ];

  private readonly COMPANY_SUFFIXES = [
    'inc', 'inc.', 'llc', 'ltd', 'ltd.', 'corp', 'corp.', 'corporation',
    'technologies', 'technology', 'solutions', 'systems', 'group',
    'enterprises', 'industries', 'holdings', 'services', 'consulting',
    'global', 'international', 'pvt ltd', 'pvt. ltd.', 'co.', 'company',
    'studios', 'labs', 'ventures'
  ];

  private readonly COUNTRIES = [
    'united states', 'usa', 'us', 'united kingdom', 'uk', 'canada', 'australia',
    'india', 'germany', 'france', 'singapore', 'united arab emirates', 'uae',
    'japan', 'netherlands', 'switzerland', 'saudi arabia', 'qatar', 'malaysia'
  ];

  parse(rawText: string): BusinessCardScanResult {
    if (!rawText || !rawText.trim()) {
      return {
        confidenceScore: 0,
        rawText: '',
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

    const claimedIndices = new Set<number>();

    // 1. Extract Emails
    const foundEmails: string[] = [];
    lines.forEach((line, index) => {
      const matches = line.match(this.EMAIL_REGEX);
      if (matches) {
        matches.forEach(email => foundEmails.push(email.trim()));
        claimedIndices.add(index);
      }
    });

    if (foundEmails.length > 0) {
      // If two emails exist, first could be personal contact, second company email or vice-versa
      result.email = foundEmails[0];
      result.contactEmail = foundEmails.length > 1 ? foundEmails[1] : foundEmails[0];
    }

    // 2. Extract Website
    lines.forEach((line, index) => {
      if (result.website) return;
      // Skip lines that are just emails
      if (line.includes('@')) return;

      const match = line.match(this.URL_REGEX);
      if (match && !match[0].toLowerCase().startsWith('mailto:')) {
        let url = match[0].trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        result.website = url;
        claimedIndices.add(index);
      }
    });

    // 3. Extract Phone & Landline
    const phoneCandidates: { phone: string; isMobile: boolean; lineIdx: number }[] = [];
    lines.forEach((line, index) => {
      const lower = line.toLowerCase();
      // Look for phone cues
      const hasMobileCue = /\b(m|mob|mobile|cell|c)\b[:.]?/i.test(line);
      const hasLandlineCue = /\b(t|tel|phone|office|ph|fax|landline)\b[:.]?/i.test(line);

      const matches = line.match(this.PHONE_REGEX);
      if (matches) {
        matches.forEach(p => {
          const cleanPhone = p.trim().replace(/[^\d+()-\s]/g, '');
          if (cleanPhone.replace(/\D/g, '').length >= 7) {
            phoneCandidates.push({
              phone: cleanPhone,
              isMobile: hasMobileCue || (!hasLandlineCue && cleanPhone.startsWith('+')),
              lineIdx: index
            });
            claimedIndices.add(index);
          }
        });
      }
    });

    if (phoneCandidates.length > 0) {
      const mobile = phoneCandidates.find(p => p.isMobile) || phoneCandidates[0];
      result.contactMobileNumber = mobile.phone;

      const landline = phoneCandidates.find(p => p !== mobile);
      if (landline) {
        result.landline = landline.phone;
      }
    }

    // 4. Extract Designation / Job Title
    let designationLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (claimedIndices.has(i)) continue;
      const lower = lines[i].toLowerCase();

      for (const desig of this.COMMON_DESIGNATIONS) {
        if (lower === desig || lower.includes(desig)) {
          result.contactDesignation = lines[i].trim();
          designationLineIdx = i;
          claimedIndices.add(i);
          break;
        }
      }
      if (result.contactDesignation) break;
    }

    // 5. Extract Contact Name
    // Usually the line right above or right below the designation line
    if (designationLineIdx > 0 && !claimedIndices.has(designationLineIdx - 1)) {
      const candidateAbove = lines[designationLineIdx - 1];
      if (this.isValidPersonName(candidateAbove)) {
        result.contactName = candidateAbove;
        claimedIndices.add(designationLineIdx - 1);
      }
    }

    if (!result.contactName && designationLineIdx >= 0 && designationLineIdx + 1 < lines.length) {
      if (!claimedIndices.has(designationLineIdx + 1)) {
        const candidateBelow = lines[designationLineIdx + 1];
        if (this.isValidPersonName(candidateBelow)) {
          result.contactName = candidateBelow;
          claimedIndices.add(designationLineIdx + 1);
        }
      }
    }

    // If still no contact name, examine the first 3 lines
    if (!result.contactName) {
      for (let i = 0; i < Math.min(3, lines.length); i++) {
        if (claimedIndices.has(i)) continue;
        if (this.isValidPersonName(lines[i])) {
          result.contactName = lines[i];
          claimedIndices.add(i);
          break;
        }
      }
    }

    // 6. Extract Company Name
    let hasCompanyWithSuffix = false;
    for (let i = 0; i < lines.length; i++) {
      if (claimedIndices.has(i)) continue;
      const lower = lines[i].toLowerCase();

      const hasSuffix = this.COMPANY_SUFFIXES.some(suffix => {
        const regex = new RegExp(`\\b${suffix}\\b`, 'i');
        return regex.test(lower);
      });

      if (hasSuffix) {
        result.companyName = lines[i].trim();
        hasCompanyWithSuffix = true;
        claimedIndices.add(i);
        break;
      }
    }

    // Only fallback to top line if other business card cues exist (phone, email, person, or website)
    const hasAnyCardCues = !!(
      result.email ||
      result.contactMobileNumber ||
      result.landline ||
      result.contactName ||
      result.contactDesignation ||
      result.website
    );

    if (!result.companyName && hasAnyCardCues) {
      for (let i = 0; i < lines.length; i++) {
        if (!claimedIndices.has(i)) {
          const text = lines[i].trim();
          // Skip if looks like address or digit heavy
          if (!/\d{3,}/.test(text) && text.length > 2 && text.length < 60) {
            result.companyName = text;
            claimedIndices.add(i);
            break;
          }
        }
      }
    }

    // 7. Extract Address, City, Country from remaining lines (only if card cues exist)
    const remainingLines: string[] = [];
    lines.forEach((line, idx) => {
      if (!claimedIndices.has(idx)) {
        remainingLines.push(line);
      }
    });

    if (remainingLines.length > 0 && hasAnyCardCues) {
      // Find Country
      remainingLines.forEach(line => {
        const lower = line.toLowerCase();
        for (const country of this.COUNTRIES) {
          if (lower.includes(country)) {
            result.country = this.formatCountryName(country);
            break;
          }
        }
      });

      // City heuristics: look for "City, State Zip" or comma separated parts
      for (const line of remainingLines) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          result.city = parts[parts.length - 2].replace(/\d+/g, '').trim();
          break;
        }
      }

      // Address: combine remaining lines that have road/street/floor keywords or digits
      const addressLines = remainingLines.filter(line =>
        /\b(st|street|ave|avenue|rd|road|blvd|boulevard|suite|ste|floor|fl|building|bldg|box|po box|lane|ln|drive|dr|way|plaza|tower)\b/i.test(line) ||
        /\d+\s+[A-Za-z]+/.test(line)
      );

      if (addressLines.length > 0) {
        result.address = addressLines.join(', ');
      } else if (remainingLines.length > 0) {
        result.address = remainingLines.slice(0, 2).join(', ');
      }
    }

    // 8. Calculate Strict Confidence Score (0% to 100%)
    let score = 0;
    if (result.email) score += 25;
    if (result.contactMobileNumber) score += 20;
    if (result.landline) score += 10;
    if (result.contactName) score += 15;
    if (result.contactDesignation) score += 10;
    if (result.website) score += 10;
    if (result.address || result.city || result.country) score += 10;

    if (hasCompanyWithSuffix) {
      score += 20;
    } else if (result.companyName && hasAnyCardCues) {
      score += 10;
    }

    // If an image had no phone, no email, and no person name, it's not a recognizable business card
    if (!result.email && !result.contactMobileNumber && !result.landline && !result.contactName) {
      score = hasCompanyWithSuffix ? 25 : 0;
    }

    result.confidenceScore = Math.min(100, score);
    result.isLowConfidence = result.confidenceScore < 35;
    return result;
  }

  private isValidPersonName(str: string): boolean {
    if (!str) return false;
    const clean = str.trim();
    // Names are typically 2 to 4 words, letters only with optional dots (e.g. John A. Smith)
    if (clean.length < 3 || clean.length > 40) return false;
    if (/\d/.test(clean)) return false;
    if (/[@#$%^&*()_+={}[\]:;"'<>?/\\|]/.test(clean)) return false;

    // Reject if it contains common company suffixes
    const lower = clean.toLowerCase();
    if (this.COMPANY_SUFFIXES.some(s => lower.includes(s))) return false;

    const words = clean.split(/\s+/);
    return words.length >= 2 && words.length <= 4;
  }

  private formatCountryName(country: string): string {
    if (country === 'usa' || country === 'us') return 'United States';
    if (country === 'uk') return 'United Kingdom';
    if (country === 'uae') return 'United Arab Emirates';
    return country.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}
