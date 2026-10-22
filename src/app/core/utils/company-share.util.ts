import { CompanyResponse } from '../models/company.model';

export function formatCompanyContactText(company: CompanyResponse): string {
  const lines: string[] = [];
  lines.push(`🏢 *${company.companyName.toUpperCase()}*`);
  if (company.contactName) {
    const desig = company.contactDesignation ? ` (${company.contactDesignation})` : '';
    lines.push(`👤 Contact: ${company.contactName}${desig}`);
  }
  if (company.contactMobileNumber) {
    lines.push(`📱 Mobile: ${company.contactMobileNumber}`);
  }
  if (company.landline) {
    lines.push(`☎️ Landline: ${company.landline}`);
  }
  if (company.email) {
    lines.push(`✉️ Email: ${company.email}`);
  }
  if (company.contactEmail && company.contactEmail !== company.email) {
    lines.push(`✉️ Direct Email: ${company.contactEmail}`);
  }
  if (company.address || company.city || company.country) {
    const loc = [company.address, company.city, company.country].filter(Boolean).join(', ');
    lines.push(`📍 Location: ${loc}`);
  }
  if (company.website) {
    lines.push(`🌐 Website: ${company.website}`);
  }
  if (company.brands && company.brands.length > 0) {
    const brandNames = company.brands.map(b => b.brandName).join(', ');
    lines.push(`🏷️ Brands Dealt: ${brandNames}`);
  }
  if (company.description) {
    lines.push(`📝 Overview: ${company.description}`);
  }
  return lines.join('\n');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.error('Failed to copy text: ', err);
    return false;
  }
}

export function shareViaWhatsApp(company: CompanyResponse): void {
  const text = formatCompanyContactText(company);
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function shareViaEmail(company: CompanyResponse): void {
  const subject = encodeURIComponent(`Contact Details: ${company.companyName}`);
  const body = encodeURIComponent(formatCompanyContactText(company));
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

export function downloadVCard(company: CompanyResponse): void {
  const contactName = company.contactName || company.companyName;
  const vCardLines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${contactName}`,
    `ORG:${company.companyName}`,
    company.contactDesignation ? `TITLE:${company.contactDesignation}` : '',
    company.contactMobileNumber ? `TEL;TYPE=CELL:${company.contactMobileNumber}` : '',
    company.landline ? `TEL;TYPE=WORK:${company.landline}` : '',
    company.contactEmail ? `EMAIL;TYPE=PREF,INTERNET:${company.contactEmail}` : '',
    company.email ? `EMAIL;TYPE=WORK,INTERNET:${company.email}` : '',
    (company.address || company.city || company.country)
      ? `ADR;TYPE=WORK:;;${company.address || ''};${company.city || ''};;;${company.country || ''}`
      : '',
    company.website ? `URL:${company.website}` : '',
    company.description ? `NOTE:${company.description.replace(/\r?\n/g, ' ')}` : '',
    'END:VCARD'
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([vCardLines], { type: 'text/vcard;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = company.companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.href = url;
  link.setAttribute('download', `${safeName}_contact.vcf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export async function shareNative(company: CompanyResponse): Promise<void> {
  const text = formatCompanyContactText(company);
  if (canNativeShare()) {
    try {
      await navigator.share({
        title: `${company.companyName} Contact Details`,
        text: text
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        await copyToClipboard(text);
      }
    }
  } else {
    await copyToClipboard(text);
  }
}
