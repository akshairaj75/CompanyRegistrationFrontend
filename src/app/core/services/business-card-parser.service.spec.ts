import { TestBed } from '@angular/core/testing';
import { BusinessCardParserService } from './business-card-parser.service';

describe('BusinessCardParserService', () => {
  let service: BusinessCardParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BusinessCardParserService]
    });
    service = TestBed.inject(BusinessCardParserService);
  });

  // 1. A complete business card with all fields
  it('should parse a complete business card with all fields', () => {
    const rawText = `
Acme Global Solutions Inc.
Sarah Jenkins
Senior Software Engineer
Mobile: +1 (555) 234-5678
Tel: +1 (555) 987-6543
Email: sarah.jenkins@acmeglobal.com
Web: https://www.acmeglobal.com
Suite 400, 100 Innovation Way
San Francisco, CA 94105
United States
    `;

    const res = service.parse(rawText);

    expect(res.companyName).toContain('Acme Global Solutions Inc.');
    expect(res.contactName).toBe('Sarah Jenkins');
    expect(res.contactDesignation).toBe('Senior Software Engineer');
    expect(res.email).toBe('sarah.jenkins@acmeglobal.com');
    expect(res.contactEmail).toBe('sarah.jenkins@acmeglobal.com');
    expect(res.contactMobileNumber).toContain('+1 (555) 234-5678');
    expect(res.landline).toContain('+1 (555) 987-6543');
    expect(res.website).toBe('https://www.acmeglobal.com');
    expect(res.city).toBe('San Francisco');
    expect(res.country).toBe('United States');
    expect(res.confidenceScore).toBeGreaterThanOrEqual(80);
    expect(res.isLowConfidence).toBe(false);
  });

  // 2. A card with a single email and phone number
  it('should parse a card with a single email and phone number', () => {
    const rawText = `
TechCorp Ltd.
Alex Rivera
Lead Engineer
contact@techcorp.io
+44 20 7946 0958
London, UK
    `;

    const res = service.parse(rawText);

    expect(res.email).toBe('contact@techcorp.io');
    expect(res.contactEmail).toBe('contact@techcorp.io');
    expect(res.contactMobileNumber).toContain('+44 20 7946 0958');
    expect(res.landline).toBeUndefined();
    expect(res.country).toBe('United Kingdom');
  });

  // 3. A card with multiple emails and phone numbers
  it('should parse multiple emails and assign primary and contactEmail correctly', () => {
    const rawText = `
Apex Dynamics
John Doe
Managing Director
john.doe@apexdynamics.com
info@apexdynamics.com
Mob: +971 50 123 4567
Office: +971 4 321 0000
Dubai, UAE
    `;

    const res = service.parse(rawText);

    expect(res.email).toBe('john.doe@apexdynamics.com');
    expect(res.contactEmail).toBe('info@apexdynamics.com');
    expect(res.contactMobileNumber).toContain('+971 50 123 4567');
    expect(res.landline).toContain('+971 4 321 0000');
    expect(res.country).toBe('United Arab Emirates');
  });

  // 4. International phone number and separately labelled landline
  it('should separate mobile and landline using cues', () => {
    const rawText = `
Vitra Global
Hans Weber
Sales Manager
Cell: +49 170 1234567
Phone: +49 89 123456
Email: weber@vitra.de
Berlin, Germany
    `;

    const res = service.parse(rawText);

    expect(res.contactMobileNumber).toContain('+49 170 1234567');
    expect(res.landline).toContain('+49 89 123456');
    expect(res.country).toBe('Germany');
  });

  // 5. Company name without a legal suffix (e.g. Knotix)
  it('should recognize company name without a suffix when correlated with email or layout', () => {
    const rawText = `
Knotix
Jane Smith
Creative Director
jane@knotix.store
+1 555 456 7890
www.knotix.store
    `;

    const res = service.parse(rawText);

    expect(res.companyName).toBe('Knotix');
    expect(res.contactName).toBe('Jane Smith');
    expect(res.contactDesignation).toBe('Creative Director');
  });

  // 6. One-word contact name (e.g., mononym like Plato or Cher)
  it('should support one-word contact name adjacent to designation', () => {
    const rawText = `
Zendro Labs
Cher
Product Manager
cher@zendro.com
+1 555 111 2222
    `;

    const res = service.parse(rawText);

    expect(res.contactName).toBe('Cher');
    expect(res.contactDesignation).toBe('Product Manager');
  });

  // 7. Contact with initials, middle names, and punctuation
  it('should support initials, periods, and hyphens in person names', () => {
    const rawText = `
Innovate Group
Dr. Robert J. O'Connor-Smith
Chief Technology Officer
robert@innovate.co.uk
+44 7700 900077
    `;

    const res = service.parse(rawText);

    expect(res.contactName).toBe("Dr. Robert J. O'Connor-Smith");
    expect(res.contactDesignation).toBe('Chief Technology Officer');
  });

  // 8. Multiline address extraction
  it('should assemble a multiline address accurately', () => {
    const rawText = `
Nexus Systems
Mark Spencer
VP Operations
mark@nexus.com
+1 800 555 0199
Building 5, 2nd Floor
450 Technology Parkway
Austin, Texas
United States
    `;

    const res = service.parse(rawText);

    expect(res.address).toContain('Building 5');
    expect(res.address).toContain('Technology Parkway');
    expect(res.city).toBe('Austin');
    expect(res.country).toBe('United States');
  });

  // 9. Location formatted as "Chennai, Tamil Nadu, India"
  it('should extract city and country from comma-separated location line', () => {
    const rawText = `
Sutherland Infotech
Vikram Raman
Solutions Architect
vikram@sutherland.in
+91 98400 12345
No 12, Mount Road, Guindy
Chennai, Tamil Nadu, India
    `;

    const res = service.parse(rawText);

    expect(res.city).toBe('Chennai');
    expect(res.country).toBe('India');
    expect(res.contactMobileNumber).toContain('+91 98400 12345');
  });

  // 10. Card with no website
  it('should handle card with no website gracefully', () => {
    const rawText = `
Local Bakery Co.
Maria Rossi
Founder
maria@localbakery.com
+1 555 777 8888
12 Baker Street
    `;

    const res = service.parse(rawText);

    expect(res.website).toBeUndefined();
    expect(res.email).toBe('maria@localbakery.com');
    expect(res.contactName).toBe('Maria Rossi');
  });

  // 11. Card with no email or phone number
  it('should score lower when email and phone are absent', () => {
    const rawText = `
Starlight Enterprise
David Miller
Account Executive
100 Broadway
New York
    `;

    const res = service.parse(rawText);

    expect(res.email).toBeUndefined();
    expect(res.contactMobileNumber).toBeUndefined();
    expect(res.confidenceScore).toBeLessThan(40);
  });

  // 12. Empty and whitespace-only OCR text
  it('should return empty result safely for blank or whitespace text', () => {
    const emptyRes = service.parse('');
    expect(emptyRes.confidenceScore).toBe(0);
    expect(emptyRes.lines.length).toBe(0);

    const spaceRes = service.parse('   \n  \t  \n  ');
    expect(spaceRes.confidenceScore).toBe(0);
    expect(spaceRes.lines.length).toBe(0);
  });

  // 13. Registration numbers, postal codes, and unrelated numeric strings
  it('should not confuse postal codes and registration IDs with phone numbers', () => {
    const rawText = `
Alpha Logistics Ltd.
Reg No: 19827364
VAT ID: 9988776655
Postal Code: 600001
Emergency: +1 (555) 444-3333
contact@alpha.com
    `;

    const res = service.parse(rawText);

    expect(res.contactMobileNumber).toBe('+1 (555) 444-3333');
    expect(res.landline).toBeUndefined();
  });

  // 14. Ambiguous company and contact names
  it('should not assign designation or email line as contact or company name', () => {
    const rawText = `
Omega Corp
Laura Croft
Head of Marketing
laura@omega.com
+1 555 999 8888
    `;

    const res = service.parse(rawText);

    expect(res.companyName).toBe('Omega Corp');
    expect(res.contactName).toBe('Laura Croft');
    expect(res.contactDesignation).toBe('Head of Marketing');
  });

  // 15. URL containing a path and trailing punctuation
  it('should clean trailing punctuation from URLs without destroying the path', () => {
    const rawText = `
Delta Software
Visit our portal at: https://delta.dev/enterprise/portal.
info@delta.dev
+1 555 000 1111
    `;

    const res = service.parse(rawText);

    expect(res.website).toBe('https://delta.dev/enterprise/portal');
  });

  // 16. Ordinary non-card document
  it('should flag an ordinary document as low confidence', () => {
    const rawText = `
Quarterly Financial Report
Q3 Results Summary
Operating expenses increased by 12% in the current fiscal period.
Net profit before tax was stable across all sectors.
    `;

    const res = service.parse(rawText);

    expect(res.confidenceScore).toBeLessThan(35);
    expect(res.isLowConfidence).toBe(true);
    expect(res.email).toBeUndefined();
    expect(res.contactMobileNumber).toBeUndefined();
  });

  // 17. Incomplete or sparse card
  it('should extract partial data from incomplete card safely', () => {
    const rawText = `
Tom Hardy
+1 555 888 9999
    `;

    const res = service.parse(rawText);

    expect(res.contactName).toBe('Tom Hardy');
    expect(res.contactMobileNumber).toContain('555 888 9999');
    expect(res.companyName).toBeUndefined();
  });

  // 18. Canadian Systems Contracting Company card (Eng./Mohammed Khaled)
  it('should parse Canadian Systems Contracting Company card correctly', () => {
    const rawText = `CS
Eng./Mohammed Khaled
Sales Department
CANADIAN SYSTEMS
CONTRACTING COMPANY
Pioneers in Integrated
Systems Solutions
Mobile:+966557020384
Email:khaleedaljundy@yahoo.com
Website: www.canadiansystems.sa
Address: Riyadh- ksa`;

    const res = service.parse(rawText);
    console.log('Parsed Canadian Systems Exact Card:', JSON.stringify(res, null, 2));

    expect(res.companyName).toContain('CANADIAN SYSTEMS CONTRACTING COMPANY');
    expect(res.contactName).toContain('Mohammed Khaled');
    expect(res.contactDesignation).toBe('Sales Department');
    expect(res.contactMobileNumber).toContain('+966557020384');
    expect(res.email).toBe('khaleedaljundy@yahoo.com');
    expect(res.address).toBeUndefined();
    expect(res.city).toBe('Riyadh');
    expect(res.country).toBe('Saudi Arabia');
  });

  // 19. Invoice document rejection
  it('should reject an invoice document and avoid extracting false business card fields', () => {
    const invoiceText = `
TAX INVOICE
Acme Supplies Corporation
Invoice #: INV-2026-091
Bill To: Enterprise Trading LLC
Date: 15/10/2026
Due Date: 30/10/2026
Description: Consulting Services
Qty: 10   Rate: $150.00   Amount: $1500.00
Subtotal: $1500.00
Total Due: $1500.00
Contact: billing@acmesupplies.com
Phone: +1 800 555 1234
    `;

    const res = service.parse(invoiceText);

    expect(res.confidenceScore).toBe(0);
    expect(res.isLowConfidence).toBe(true);
    expect(res.companyName).toBeUndefined();
    expect(res.contactName).toBeUndefined();
    expect(res.email).toBeUndefined();
    expect(res.contactMobileNumber).toBeUndefined();
  });

  // 20. Resume / CV rejection
  it('should reject a resume / CV and avoid populating false contact fields', () => {
    const resumeText = `
Curriculum Vitae
Alexander Wright
Senior Software Architect
Summary: Over 12 years of work experience in enterprise software.
Employment History:
Lead Engineer at Apex Systems (2018 - 2024)
Education: Master of Science in Computer Engineering
Contact: alexander.wright@gmail.com
Phone: +1 415 555 0199
    `;

    const res = service.parse(resumeText);

    expect(res.confidenceScore).toBe(0);
    expect(res.isLowConfidence).toBe(true);
    expect(res.companyName).toBeUndefined();
    expect(res.contactName).toBeUndefined();
    expect(res.email).toBeUndefined();
  });

  // 21. POS / Retail receipt rejection
  it('should reject a retail store receipt and avoid populating false fields', () => {
    const receiptText = `
STORE RECEIPT
Metro Supermarket #104
Cashier: Jennifer M.
Item 1: Organic Milk    $4.50
Item 2: Whole Wheat Bread $3.20
Subtotal: $7.70
Sales Tax: $0.62
Total Amount: $8.32
Tendered: $10.00   Change Due: $1.68
Transaction ID: TXN-9928172
Thank you for shopping with us!
    `;

    const res = service.parse(receiptText);

    expect(res.confidenceScore).toBe(0);
    expect(res.isLowConfidence).toBe(true);
    expect(res.companyName).toBeUndefined();
    expect(res.contactName).toBeUndefined();
  });
});

