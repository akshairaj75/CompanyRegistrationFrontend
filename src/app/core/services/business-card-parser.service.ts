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

  // Phone candidate pattern: matches phone strings with optional country code (+966, 00966, etc.),
  // domestic area codes / zero prefixes, 7 to 15 digits total, and optional extension
  private readonly PHONE_CANDIDATE_REGEX = /(?:(?:\+|00)\d{1,4}[-.\s]*)?(?:\(?\d{1,5}\)?[-.\s]*)?\d{2,5}(?:[-.\s]*\d{2,5}){1,4}(?:[-.\s]*(?:ext|x|extension|extn)[:.\s]*\d{1,5})?/gi;

  // Phone type indicators
  private readonly MOBILE_LABEL_REGEX = /\b(?:m|mob|mobile|cell|c)\b[:.\-\s]?/i;
  private readonly LANDLINE_LABEL_REGEX = /\b(?:t|tel|telephone|phone|ph|office|off|direct|dir|landline)\b[:.\-\s]?/i;
  private readonly FAX_LABEL_REGEX = /\b(?:f|fax|facsimile)\b[:.\-\s]?/i;

  // Non-phone cue blacklist: labels like "Reg No:", "VAT:", "Postal Code:", "Zip:"
  private readonly NON_PHONE_LINE_REGEX = /\b(?:reg|registration|reg\.?\s*no|vat|tin|cin|gst|gstin|postal|post\s*code|zip|zipcode|pincode|pin|cr|tax|license|licence|date|iso)\b[:.\-\s]?/i;

  // Patterns that strongly indicate a document is NOT a business card (Invoices, Receipts, Resumes, Contracts, Statements, etc.)
  private readonly NON_BUSINESS_CARD_PATTERNS: RegExp[] = [
    // Invoices, Billing, Quotations
    /\b(?:tax\s*invoice|commercial\s*invoice|proforma\s*invoice|invoice\s*(?:#|no|num|number)|bill\s*to|ship\s*to|sold\s*to|due\s*date|payment\s*due|payment\s*terms|amount\s*due|balance\s*due|total\s*due|total\s*amount|subtotal|grand\s*total|unit\s*price|qty\b|remit\s*to|remittance|account\s*payable|sales\s*tax|vat\s*amount)\b/i,

    // Receipts & Point of Sale
    /\b(?:sales\s*receipt|cash\s*receipt|receipt\s*(?:#|no|num|number)|cashier\b|change\s*due|tendered|merchant\s*id|terminal\s*id|transaction\s*id|pos\s*receipt|total\s*items)\b/i,

    // Purchase Orders & Delivery Challans
    /\b(?:purchase\s*order|p\.?o\.?\s*(?:#|no|num|number)|quotation\s*(?:#|no|num|number)|quote\s*(?:#|no|num|number)|request\s*for\s*quotation|estimate\s*(?:#|no|num|number)|delivery\s*order|delivery\s*challan|goods\s*received\s*note)\b/i,

    // Contracts, Agreements & Legal Notices
    /\b(?:agreement\s*between|memorandum\s*of\s*understanding|mou\b|terms\s*(?:and|&)\s*conditions|confidentiality\s*agreement|non-disclosure\s*agreement|nda\b|power\s*of\s*attorney|affidavit\b|board\s*resolution|witnesseth\b|hereunto\s*set|party\s*of\s*the\s*(?:first|second)\s*part|parties\s*hereto)\b/i,

    // Resumes & Curriculum Vitae
    /\b(?:curriculum\s*vitae|\bc\.?v\.?\b|career\s*objective|professional\s*summary|work\s*experience|employment\s*history|educational\s*qualification|academic\s*qualifications|skills\s*(?:and|&)\s*abilities|declaration\s*:.*true|hobbies\s*:)\b/i,

    // Bank Statements & Financial Records
    /\b(?:bank\s*statement|statement\s*of\s*account|account\s*statement|credit\s*card\s*statement|opening\s*balance|closing\s*balance|available\s*balance|ledger\s*balance|withdrawal\s*slip|deposit\s*slip)\b/i,

    // Passports & Government ID
    /\b(?:driving\s*licen[sc]e|driver\s*licen[sc]e|passport\s*no|republic\s*of\s+[a-z]+|national\s*id\b|date\s*of\s*birth|d\.?o\.?b\.?\s*:|place\s*of\s*birth|blood\s*group|citizenship\s*:)\b/i,

    // Medical & Clinical Reports
    /\b(?:patient\s*name|doctor\s*in\s*charge|clinical\s*laboratory|lab\s*report|test\s*report|reference\s*range|investigation\s*report|vital\s*signs|patient\s*id)\b/i,

    // Formal Letters & Memos
    /\b(?:dear\s*(?:sir|madam|mr|ms|dr)\b|to\s*whom\s*it\s*may\s*concern|yours\s*faithfully|yours\s*sincerely|with\s*warm\s*regards)\b/i,

    // Reports, Manuals & Policies
    /\b(?:quarterly\s*report|annual\s*report|financial\s*report|audit\s*report|meeting\s*minutes|instruction\s*manual|user\s*guide|privacy\s*policy|terms\s*of\s*service)\b/i,

    // Shipping & Customs
    /\b(?:bill\s*of\s*lading|airway\s*bill|consignment\s*note|packing\s*list|customs\s*declaration|gross\s*weight\s*:|net\s*weight\s*:)\b/i
  ];

  // Expanded and realistic designations list
  private readonly COMMON_DESIGNATIONS =  [
  // =====================================================
  // 1. C-SUITE AND TOP EXECUTIVES
  // =====================================================
  'chief executive officer', 'ceo', 'chief executive',
  'chief operating officer', 'coo',
  'chief technology officer', 'cto',
  'chief information officer', 'cio',
  'chief information security officer', 'ciso',
  'chief financial officer', 'cfo',
  'chief marketing officer', 'cmo',
  'chief human resources officer', 'chro',
  'chief people officer', 'cpo',
  'chief product officer', 'chief product officer',
  'chief revenue officer', 'cro',
  'chief commercial officer', 'cco',
  'chief strategy officer', 'cso',
  'chief security officer',
  'chief data officer', 'cdo',
  'chief digital officer',
  'chief innovation officer',
  'chief risk officer',
  'chief compliance officer',
  'chief legal officer', 'clo',
  'chief administrative officer', 'cao',
  'chief procurement officer',
  'chief supply chain officer',
  'chief experience officer',
  'chief sustainability officer',
  'chief medical officer',
  'chief scientific officer',
  'chief investment officer',
  'chief communications officer',
  'chief growth officer',
  'chief transformation officer',
  'chief business officer',
  'chief accounting officer',
  'chief design officer',
  'chief analytics officer',
  'chief strategy and transformation officer',
  'president', 'company president',
  'executive president', 'vice chairman', 'chairman',
  'chairperson', 'chairman of the board',
  'managing director', 'joint managing director',
  'executive managing director', 'group managing director',
  'deputy managing director', 'assistant managing director',
  'executive director', 'non-executive director',
  'independent director', 'whole-time director',
  'additional director', 'board director',
  'board member', 'member of the board',
  'group director', 'regional director',
  'country director', 'corporate director',
  'general director', 'director general',
  'founder', 'co-founder', 'founding partner',
  'founding director', 'business owner', 'owner',
  'proprietor', 'sole proprietor', 'co-owner',
  'partner', 'managing partner', 'senior partner',
  'equity partner', 'general partner', 'limited partner',
  'principal', 'principal owner', 'promoter',
  'entrepreneur', 'business promoter',
  'investor', 'venture partner',
  'board advisor', 'strategic advisor',

  // =====================================================
  // 2. VICE PRESIDENT AND EXECUTIVE MANAGEMENT
  // =====================================================
  'vice president', 'vp', 'avp', 'svp', 'evp',
  'assistant vice president', 'associate vice president',
  'senior vice president', 'executive vice president',
  'deputy vice president', 'group vice president',
  'global vice president', 'regional vice president',
  'country vice president', 'area vice president',
  'vice president of operations',
  'vice president of engineering',
  'vice president of technology',
  'vice president of sales',
  'vice president of marketing',
  'vice president of finance',
  'vice president of human resources',
  'vice president of product',
  'vice president of business development',
  'vice president of strategy',
  'vice president of administration',
  'vice president of research and development',
  'vice president of customer success',
  'vice president of information technology',
  'vice president of manufacturing',
  'vice president of supply chain',
  'vice president of procurement',
  'vice president of legal',
  'vice president of quality',
  'vice president of security',
  'vice president of communications',
  'vice president of international business',
  'executive officer', 'corporate officer',
  'group executive', 'senior executive',
  'executive management', 'executive manager',
  'corporate executive', 'business executive',
  'regional executive', 'country executive',
  'area executive', 'unit head',
  'business unit head', 'business unit manager',
  'group head', 'department head',
  'head of department', 'hod',
  'division head', 'division manager',
  'regional head', 'country head',
  'area head', 'zone head',
  'territory head', 'cluster head',
  'business head', 'function head',
  'practice head', 'vertical head',
  'segment head', 'branch head',
  'corporate head', 'global head',
  'national head', 'state head',

  // =====================================================
  // 3. GENERAL MANAGEMENT AND ADMINISTRATION
  // =====================================================
  'chief general manager', 'general manager', 'gm',
  'senior general manager', 'deputy general manager', 'dgm',
  'assistant general manager', 'agm',
  'additional general manager',
  'joint general manager',
  'executive general manager',
  'group general manager',
  'regional general manager',
  'area general manager',
  'unit general manager',
  'plant general manager',
  'factory general manager',
  'branch general manager',
  'operations general manager',
  'commercial general manager',
  'project general manager',
  'general manager operations',
  'general manager sales',
  'general manager marketing',
  'general manager finance',
  'general manager hr',
  'general manager administration',
  'general manager production',
  'general manager projects',
  'general manager technical',
  'general manager business development',
  'manager', 'senior manager',
  'deputy manager', 'assistant manager',
  'associate manager', 'junior manager',
  'executive manager', 'functional manager',
  'line manager', 'middle manager',
  'top-level manager', 'business manager',
  'corporate manager', 'regional manager',
  'area manager', 'territory manager',
  'zone manager', 'cluster manager',
  'district manager', 'state manager',
  'country manager', 'national manager',
  'branch manager', 'office manager',
  'unit manager', 'department manager',
  'division manager', 'section manager',
  'site manager', 'facility manager',
  'plant manager', 'factory manager',
  'production manager', 'service manager',
  'administration manager', 'admin manager',
  'assistant administrator', 'administrator',
  'senior administrator', 'office administrator',
  'business administrator', 'corporate administrator',
  'administrative officer', 'administrative executive',
  'administrative assistant', 'executive assistant',
  'personal assistant', 'pa', 'personal secretary',
  'company secretary', 'assistant company secretary',
  'deputy company secretary', 'secretarial officer',
  'management trainee', 'graduate management trainee',
  'management consultant', 'management analyst',
  'chief of staff', 'business operations lead',
  'operations coordinator', 'administrative coordinator', 'sales coordinator', 'project coordinator',
  'management associate', 'management officer',

  // =====================================================
  // 4. TECHNOLOGY, IT AND SOFTWARE
  // =====================================================
  'chief architect', 'chief technology architect',
  'chief information architect', 'enterprise architect',
  'solution architect', 'solutions architect',
  'software architect', 'application architect',
  'technical architect', 'cloud architect',
  'data architect', 'security architect',
  'infrastructure architect', 'network architect',
  'systems architect', 'integration architect',
  'platform architect', 'domain architect',
  'enterprise solutions architect',
  'principal architect', 'associate architect',
  'technical director', 'engineering director',
  'director of technology', 'director of engineering',
  'director of information technology',
  'director of software engineering',
  'director of infrastructure',
  'director of cybersecurity',
  'director of data engineering',
  'director of product engineering',
  'head of technology', 'head of it',
  'head of engineering', 'head of software',
  'head of software development',
  'head of application development',
  'head of infrastructure', 'head of cybersecurity',
  'head of information security', 'head of data',
  'head of cloud engineering', 'head of architecture',
  'head of quality assurance', 'head of testing',
  'head of technical support', 'head of IT operations',
  'it manager', 'it director', 'it administrator',
  'it officer', 'it executive', 'it coordinator',
  'it support engineer', 'it support specialist',
  'it support technician', 'it analyst',
  'systems administrator', 'system administrator',
  'systems engineer', 'system engineer',
  'systems analyst', 'system analyst',
  'network administrator', 'network engineer',
  'network analyst', 'network specialist',
  'network technician', 'database administrator',
  'database developer', 'database engineer',
  'database analyst', 'sql developer',
  'software engineer', 'software developer',
  'application developer', 'application engineer',
  'web developer', 'website developer',
  'frontend developer', 'front-end developer',
  'backend developer', 'back-end developer',
  'full stack developer', 'full-stack developer',
  'mobile app developer', 'android developer',
  'ios developer', 'cross-platform developer',
  'java developer', 'python developer',
  'javascript developer', 'typescript developer',
  'c developer', 'c++ developer', 'c# developer',
  '.net developer', 'php developer',
  'ruby developer', 'go developer', 'golang developer',
  'rust developer', 'react developer',
  'angular developer', 'vue developer',
  'node.js developer', 'spring boot developer',
  'software programmer', 'programmer',
  'computer programmer', 'application programmer',
  'senior software engineer', 'junior software engineer',
  'associate software engineer', 'staff software engineer',
  'principal software engineer', 'lead software engineer',
  'senior developer', 'junior developer',
  'associate developer', 'lead developer',
  'principal developer', 'technical lead',
  'tech lead', 'team lead', 'development team lead',
  'engineering lead', 'software development lead',
  'software development manager',
  'engineering manager', 'application manager',
  'release manager', 'configuration manager',
  'build engineer', 'release engineer',
  'devops engineer', 'senior devops engineer',
  'devops lead', 'devops manager',
  'site reliability engineer', 'sre',
  'platform engineer', 'cloud engineer',
  'cloud consultant', 'cloud administrator',
  'cloud solutions engineer', 'aws engineer',
  'azure engineer', 'google cloud engineer',
  'kubernetes engineer', 'containerization engineer',
  'infrastructure engineer', 'infrastructure manager',
  'linux administrator', 'unix administrator',
  'windows administrator', 'virtualization engineer',
  'cybersecurity engineer', 'security engineer',
  'information security analyst', 'security analyst',
  'security consultant', 'penetration tester',
  'ethical hacker', 'vulnerability analyst',
  'incident response analyst', 'soc analyst',
  'security operations manager', 'security architect',
  'application security engineer', 'iam engineer',
  'data engineer', 'senior data engineer',
  'data scientist', 'senior data scientist',
  'machine learning engineer', 'ai engineer',
  'artificial intelligence engineer',
  'deep learning engineer', 'nlp engineer',
  'computer vision engineer', 'ml engineer',
  'mlops engineer', 'research engineer',
  'research scientist', 'data analyst',
  'business intelligence developer', 'bi developer',
  'business intelligence analyst', 'bi analyst',
  'analytics engineer', 'data consultant',
  'big data engineer', 'big data developer',
  'etl developer', 'data warehouse engineer',
  'data architect', 'reporting analyst',
  'power bi developer', 'tableau developer',
  'robotics engineer', 'embedded systems engineer',
  'firmware engineer', 'hardware engineer',
  'electronic design engineer', 'fpga engineer',
  'vlsi engineer', 'semiconductor engineer',
  'iot engineer', 'automation engineer',
  'test automation engineer', 'qa engineer',
  'quality assurance engineer', 'qa analyst',
  'software tester', 'manual tester',
  'automation tester', 'performance tester',
  'penetration testing engineer', 'test lead',
  'test manager', 'quality engineering manager',
  'technical support engineer', 'technical support analyst',
  'technical support executive', 'support engineer',
  'help desk analyst', 'service desk analyst',
  'help desk technician', 'desktop support engineer',
  'field service engineer', 'field support engineer',
  'technical consultant', 'it consultant',
  'software consultant', 'solution consultant',
  'implementation consultant', 'technical specialist',
  'technology specialist', 'product support engineer',
  'erp consultant', 'sap consultant',
  'salesforce developer', 'salesforce administrator',
  'sap basis consultant', 'oracle consultant',
  'sharepoint developer', 'blockchain developer',
  'game developer', 'game programmer',
  'technical writer', 'api developer',

  // =====================================================
  // 5. SALES AND BUSINESS DEVELOPMENT
  // =====================================================
  'chief sales officer', 'sales director',
  'director of sales', 'head of sales',
  'national sales manager', 'regional sales manager',
  'area sales manager', 'territory sales manager',
  'district sales manager', 'zone sales manager',
  'branch sales manager', 'state sales manager',
  'sales manager', 'senior sales manager',
  'assistant sales manager', 'deputy sales manager',
  'sales team leader', 'sales team lead',
  'sales supervisor', 'sales officer',
  'sales executive', 'senior sales executive',
  'junior sales executive', 'sales representative',
  'sales associate', 'sales consultant',
  'sales specialist', 'sales coordinator',
  'sales administrator', 'sales analyst',
  'sales engineer', 'technical sales engineer',
  'sales development representative', 'sdr',
  'business development representative', 'bdr',
  'business development manager', 'bdm',
  'business development executive', 'bde',
  'senior business development executive',
  'business development officer',
  'business development associate',
  'business development consultant',
  'business development director',
  'head of business development',
  'business development lead',
  'business growth manager', 'growth manager',
  'growth executive', 'growth specialist',
  'commercial manager', 'commercial director',
  'commercial executive', 'commercial officer',
  'commercial analyst', 'commercial lead',
  'key account manager', 'senior account manager',
  'national account manager', 'global account manager',
  'strategic account manager', 'account manager',
  'account executive', 'account director',
  'key account executive', 'account coordinator',
  'account representative', 'client relationship manager',
  'customer relationship manager', 'crm manager',
  'relationship manager', 'senior relationship manager',
  'assistant relationship manager',
  'customer relationship officer', 'client partner',
  'client servicing manager', 'client service executive',
  'customer acquisition manager', 'acquisition executive',
  'channel sales manager', 'channel manager',
  'channel partner manager', 'dealer development manager',
  'distributor sales manager', 'dealer manager',
  'retail sales manager', 'institutional sales manager',
  'enterprise sales manager', 'inside sales manager',
  'inside sales executive', 'outbound sales executive',
  'field sales executive', 'field sales officer',
  'direct sales executive', 'corporate sales manager',
  'international sales manager', 'export sales manager',
  'pre-sales consultant', 'presales engineer',
  'sales operations manager', 'sales operations analyst',
  'sales enablement manager', 'revenue operations manager',
  'revenue manager', 'telesales executive',
  'telemarketing executive', 'sales promoter',
  'sales merchandiser', 'business executive',
  'business officer', 'business analyst',
  'business strategy manager', 'strategic partnerships manager',
  'partnerships manager', 'partnerships executive',
  'alliances manager', 'alliance executive',
  'franchise development manager', 'franchise manager',
  'tendering manager', 'tender executive',
  'bid manager', 'bid executive',
  'proposal manager', 'proposal specialist',

  // =====================================================
  // 6. MARKETING, ADVERTISING AND COMMUNICATIONS
  // =====================================================
  'chief marketing officer', 'marketing director',
  'director of marketing', 'head of marketing',
  'marketing manager', 'senior marketing manager',
  'assistant marketing manager', 'marketing executive',
  'senior marketing executive', 'marketing officer',
  'marketing associate', 'marketing coordinator',
  'marketing analyst', 'marketing specialist',
  'marketing consultant', 'marketing strategist',
  'brand manager', 'senior brand manager',
  'assistant brand manager', 'brand executive',
  'brand strategist', 'brand director',
  'product marketing manager', 'product marketing executive',
  'digital marketing manager', 'digital marketing executive',
  'digital marketing specialist', 'digital marketer',
  'performance marketing manager', 'performance marketer',
  'growth marketing manager', 'content marketing manager',
  'content strategist', 'content manager',
  'content writer', 'copywriter', 'senior copywriter',
  'technical copywriter', 'creative copywriter',
  'seo manager', 'seo executive', 'seo specialist',
  'search engine optimization specialist',
  'sem specialist', 'ppc specialist',
  'paid media manager', 'media buyer',
  'social media manager', 'social media executive',
  'social media specialist', 'community manager',
  'influencer marketing manager', 'influencer relations manager',
  'affiliate marketing manager', 'affiliate manager',
  'email marketing manager', 'email marketing specialist',
  'marketing automation specialist', 'crm marketing manager',
  'campaign manager', 'campaign executive',
  'advertising manager', 'advertising executive',
  'advertising specialist', 'media planner',
  'media planning manager', 'media relations manager',
  'public relations manager', 'pr manager',
  'public relations executive', 'pr executive',
  'communications manager', 'corporate communications manager',
  'communications executive', 'communications officer',
  'internal communications manager',
  'external communications manager', 'press officer',
  'press secretary', 'publicist',
  'creative director', 'associate creative director',
  'art director', 'creative manager',
  'graphic designer', 'senior graphic designer',
  'visual designer', 'visual communication designer',
  'brand designer', 'logo designer',
  'ui designer', 'ux designer', 'ui/ux designer',
  'product designer', 'web designer',
  'website designer', 'motion graphics designer',
  'motion designer', 'video editor',
  'photographer', 'videographer',
  'creative producer', 'artwork coordinator',
  'market research analyst', 'market research manager',
  'consumer insights analyst', 'customer insights manager',
  'trade marketing manager', 'retail marketing manager',
  'field marketing manager', 'event marketing manager',
  'event manager', 'event coordinator',
  'exhibition manager', 'sponsorship manager',
  'visual merchandising manager', 'merchandising executive',

  // =====================================================
  // 7. FINANCE, ACCOUNTING AND BANKING
  // =====================================================
  'finance director', 'director of finance',
  'head of finance', 'finance manager',
  'senior finance manager', 'assistant finance manager',
  'finance executive', 'finance officer',
  'finance analyst', 'financial analyst',
  'senior financial analyst', 'financial controller',
  'group financial controller', 'financial accountant',
  'management accountant', 'cost accountant',
  'project accountant', 'corporate accountant',
  'staff accountant', 'accountant',
  'senior accountant', 'junior accountant',
  'assistant accountant', 'accounts manager',
  'accounts executive', 'accounts officer',
  'accounts assistant', 'accounting manager',
  'accounting executive', 'accounting officer',
  'chief accountant', 'deputy chief accountant',
  'accounts payable manager', 'accounts payable executive',
  'accounts receivable manager', 'accounts receivable executive',
  'billing executive', 'billing manager',
  'payroll manager', 'payroll executive',
  'tax manager', 'tax consultant',
  'tax analyst', 'tax accountant',
  'tax advisor', 'tax advisor',
  'chartered accountant', 'ca',
  'cost accountant', 'cost and management accountant',
  'cma', 'certified public accountant', 'cpa',
  'certified management accountant',
  'company auditor', 'internal auditor',
  'external auditor', 'statutory auditor',
  'audit manager', 'audit executive',
  'audit associate', 'audit partner',
  'forensic accountant', 'forensic auditor',
  'treasury manager', 'treasury analyst',
  'investment analyst', 'investment manager',
  'portfolio manager', 'fund manager',
  'wealth manager', 'wealth advisor',
  'financial advisor', 'financial adviser',
  'financial planner', 'investment advisor',
  'risk manager', 'financial risk analyst',
  'credit risk analyst', 'credit manager',
  'credit officer', 'credit analyst',
  'loan officer', 'loan manager',
  'mortgage advisor', 'debt recovery officer',
  'collections manager', 'collections executive',
  'bank manager', 'branch banking manager',
  'banking officer', 'banking executive',
  'relationship officer', 'relationship banker',
  'personal banker', 'private banker',
  'investment banker', 'corporate banker',
  'banking relationship manager',
  'operations officer banking', 'cash officer',
  'cashier', 'chief cashier',
  'teller', 'bank teller',
  'insurance advisor', 'insurance agent',
  'insurance manager', 'insurance underwriter',
  'underwriting manager', 'claims manager',
  'claims officer', 'actuary', 'actuarial analyst',
  'actuarial manager', 'reinsurance manager',
  'compliance analyst', 'compliance officer',
  'compliance manager', 'anti-money laundering analyst',
  'aml analyst', 'kyc analyst',
  'fraud analyst', 'fraud investigator',
  'financial operations analyst', 'fintech analyst',

  // =====================================================
  // 8. HUMAN RESOURCES AND RECRUITMENT
  // =====================================================
  'chief human resources officer', 'chief people officer',
  'hr director', 'director of human resources',
  'head of hr', 'head of human resources',
  'head of people', 'head of talent',
  'human resources manager', 'hr manager',
  'senior hr manager', 'assistant hr manager',
  'deputy hr manager', 'hr executive',
  'senior hr executive', 'hr officer',
  'hr associate', 'hr administrator',
  'hr coordinator', 'hr assistant',
  'human resources generalist', 'hr generalist',
  'human resources specialist', 'hr specialist',
  'human resources business partner', 'hrbp',
  'senior hr business partner', 'people partner',
  'people operations manager', 'people operations executive',
  'employee relations manager', 'employee relations officer',
  'industrial relations manager', 'industrial relations officer',
  'labour relations officer', 'labor relations manager',
  'talent acquisition manager', 'talent acquisition specialist',
  'talent acquisition executive', 'recruitment manager',
  'recruiter', 'technical recruiter',
  'it recruiter', 'corporate recruiter',
  'senior recruiter', 'recruitment consultant',
  'recruitment executive', 'recruitment coordinator',
  'staffing manager', 'staffing specialist',
  'sourcing specialist', 'talent sourcer',
  'executive search consultant', 'headhunter',
  'learning and development manager', 'l&d manager',
  'training manager', 'training executive',
  'training coordinator', 'corporate trainer',
  'technical trainer', 'soft skills trainer',
  'organizational development manager',
  'organizational development specialist',
  'performance management specialist',
  'compensation and benefits manager',
  'compensation analyst', 'benefits administrator',
  'payroll administrator', 'payroll officer',
  'employee engagement manager', 'employee experience manager',
  'workforce planning manager', 'workforce analyst',
  'diversity and inclusion manager',
  'people and culture manager', 'hr consultant',
  'hr advisor', 'hr adviser', 'hr business analyst',

  // =====================================================
  // 9. OPERATIONS, PROCUREMENT AND SUPPLY CHAIN
  // =====================================================
  'chief operating officer', 'operations director',
  'director of operations', 'head of operations',
  'operations manager', 'senior operations manager',
  'assistant operations manager', 'operations executive',
  'operations officer', 'operations analyst',
  'operations coordinator', 'operations supervisor',
  'business operations manager', 'service operations manager',
  'operational excellence manager', 'process improvement manager',
  'continuous improvement manager', 'lean manager',
  'six sigma manager', 'workflow manager',
  'process manager', 'process analyst',
  'procurement director', 'head of procurement',
  'procurement manager', 'procurement officer',
  'procurement executive', 'procurement specialist',
  'purchasing manager', 'purchasing officer',
  'purchasing executive', 'buyer',
  'senior buyer', 'strategic sourcing manager',
  'sourcing manager', 'sourcing specialist',
  'vendor manager', 'vendor development manager',
  'vendor relationship manager', 'supplier manager',
  'supplier quality engineer', 'supplier development engineer',
  'supply chain director', 'head of supply chain',
  'supply chain manager', 'supply chain executive',
  'supply chain analyst', 'supply chain planner',
  'logistics director', 'head of logistics',
  'logistics manager', 'logistics executive',
  'logistics coordinator', 'logistics officer',
  'transport manager', 'transportation manager',
  'fleet manager', 'fleet supervisor',
  'warehouse manager', 'warehouse supervisor',
  'warehouse executive', 'warehouse officer',
  'inventory manager', 'inventory controller',
  'inventory executive', 'stock controller',
  'materials manager', 'materials controller',
  'material planning manager', 'materials planner',
  'demand planning manager', 'demand planner',
  'supply planner', 'production planner',
  'distribution manager', 'distribution executive',
  'dispatch manager', 'dispatch executive',
  'shipping manager', 'shipping executive',
  'freight manager', 'freight forwarder',
  'customs clearance executive', 'customs broker',
  'import manager', 'export manager',
  'import export manager', 'export executive',
  'import executive', 'international trade manager',
  'trade compliance manager', 'order management specialist',
  'order processing executive', 'fulfillment manager',
  'fulfilment manager', 'last mile operations manager',
  'route planner', 'transport coordinator',

  // =====================================================
  // 10. CUSTOMER SERVICE AND CUSTOMER SUCCESS
  // =====================================================
  'customer service director', 'head of customer service',
  'customer service manager', 'customer care manager',
  'customer support manager', 'customer success manager',
  'senior customer success manager', 'customer success director',
  'customer success executive', 'customer success specialist',
  'customer success associate', 'customer success engineer',
  'customer service executive', 'customer service officer',
  'customer service representative', 'customer care executive',
  'customer care executive', 'customer care officer',
  'customer support executive', 'customer support officer',
  'customer support specialist', 'customer support analyst',
  'customer support representative', 'support manager',
  'service delivery manager', 'service delivery executive',
  'service delivery lead', 'service coordinator',
  'client services manager', 'client services executive',
  'client success manager', 'client support specialist',
  'call center manager', 'call centre manager',
  'contact center manager', 'contact centre manager',
  'call center supervisor', 'call centre supervisor',
  'team leader customer service', 'call center executive',
  'call centre executive', 'contact center agent',
  'customer experience manager', 'customer experience specialist',
  'customer experience analyst', 'customer experience executive',
  'complaint manager', 'complaint resolution officer',
  'grievance officer', 'grievance manager',
  'escalation manager', 'escalation specialist',
  'technical account manager', 'customer onboarding specialist',
  'implementation manager', 'onboarding manager',
  'customer retention manager', 'customer relations executive',
  'customer relations officer', 'customer liaison officer',

  // =====================================================
  // 11. PROJECT, PROGRAM AND PRODUCT MANAGEMENT
  // =====================================================
  'project director', 'project manager',
  'senior project manager', 'junior project manager',
  'assistant project manager', 'associate project manager',
  'deputy project manager', 'technical project manager',
  'it project manager', 'software project manager',
  'construction project manager', 'engineering project manager',
  'infrastructure project manager', 'digital project manager',
  'implementation project manager', 'project coordinator',
  'project executive', 'project officer',
  'project engineer', 'project planner',
  'project controller', 'project scheduler',
  'project analyst', 'project administrator',
  'program director', 'program manager',
  'senior program manager', 'technical program manager',
  'programme manager', 'programme director',
  'program coordinator', 'program officer',
  'portfolio manager', 'project portfolio manager',
  'pmo manager', 'pmo analyst',
  'project management officer', 'pmo lead',
  'scrum master', 'senior scrum master',
  'agile coach', 'agile delivery manager',
  'agile project manager', 'release train engineer',
  'product director', 'product manager',
  'senior product manager', 'associate product manager',
  'assistant product manager', 'technical product manager',
  'digital product manager', 'software product manager',
  'product owner', 'senior product owner',
  'associate product owner', 'technical product owner',
  'product analyst', 'product operations manager',
  'product operations analyst', 'product specialist',
  'product development manager', 'product development executive',
  'product coordinator', 'product strategist',
  'business analyst', 'senior business analyst',
  'junior business analyst', 'associate business analyst',
  'technical business analyst', 'it business analyst',
  'functional analyst', 'systems business analyst',
  'business systems analyst', 'business process analyst',
  'requirements analyst', 'requirements engineer',
  'process consultant', 'transformation manager',
  'change manager', 'change management consultant',
  'delivery manager', 'delivery lead',
  'technical delivery manager', 'engagement manager',

  // =====================================================
  // 12. ENGINEERING, MANUFACTURING AND QUALITY
  // =====================================================
  'chief engineer', 'engineering director',
  'engineering manager', 'senior engineering manager',
  'engineering supervisor', 'engineering officer',
  'engineering executive', 'engineering consultant',
  'principal engineer', 'staff engineer',
  'lead engineer', 'senior engineer',
  'associate engineer', 'junior engineer',
  'graduate engineer trainee', 'get',
  'trainee engineer', 'design engineer',
  'mechanical engineer', 'senior mechanical engineer',
  'electrical engineer', 'senior electrical engineer',
  'electronics engineer', 'electronic engineer',
  'civil engineer', 'senior civil engineer',
  'structural engineer', 'geotechnical engineer',
  'chemical engineer', 'process engineer',
  'industrial engineer', 'production engineer',
  'manufacturing engineer', 'plant engineer',
  'maintenance engineer', 'maintenance manager',
  'maintenance supervisor', 'service engineer',
  'field engineer', 'application engineer',
  'instrumentation engineer', 'control systems engineer',
  'automation engineer', 'mechatronics engineer',
  'automotive engineer', 'aerospace engineer',
  'aeronautical engineer', 'marine engineer',
  'petroleum engineer', 'mining engineer',
  'metallurgical engineer', 'materials engineer',
  'environmental engineer', 'biomedical engineer',
  'chemical plant engineer', 'reliability engineer',
  'project design engineer', 'cad engineer',
  'cad designer', 'draughtsman', 'draftsman',
  'design manager', 'engineering design manager',
  'research and development manager', 'r&d manager',
  'research and development engineer', 'r&d engineer',
  'research and development executive',
  'innovation engineer', 'product development engineer',
  'production director', 'production manager',
  'production supervisor', 'production officer',
  'production executive', 'production planner',
  'manufacturing manager', 'manufacturing supervisor',
  'plant supervisor', 'factory supervisor',
  'shift manager', 'shift supervisor',
  'shift engineer', 'line supervisor',
  'assembly line supervisor', 'machine operator',
  'plant operator', 'production operator',
  'quality director', 'quality manager',
  'quality assurance manager', 'quality control manager',
  'quality assurance officer', 'quality control officer',
  'quality assurance executive', 'quality control executive',
  'quality engineer', 'quality inspector',
  'quality analyst', 'quality auditor',
  'supplier quality manager', 'process quality engineer',
  'food safety manager', 'hse manager',
  'health and safety manager', 'safety officer',
  'safety engineer', 'environmental health and safety officer',
  'ehs officer', 'eHS manager',
  'industrial safety officer', 'fire safety officer',
  'maintenance technician', 'electrical technician',
  'mechanical technician', 'field technician',
  'service technician', 'laboratory technician',
  'laboratory manager', 'lab technician',
  'technical officer', 'technical manager',
  'technical superintendent', 'technical inspector',

  // =====================================================
  // 13. CONSTRUCTION, ARCHITECTURE AND REAL ESTATE
  // =====================================================
  'construction director', 'construction manager',
  'senior construction manager', 'site manager',
  'site engineer', 'senior site engineer',
  'site supervisor', 'site in-charge',
  'project site manager', 'civil site engineer',
  'construction supervisor', 'construction engineer',
  'resident engineer', 'resident project manager',
  'planning engineer', 'planning manager',
  'quantity surveyor', 'senior quantity surveyor',
  'quantity surveying manager', 'estimation engineer',
  'estimator', 'cost estimator',
  'cost control engineer', 'cost control manager',
  'contracts manager', 'contract engineer',
  'contract administrator', 'tender engineer',
  'bim manager', 'bim coordinator',
  'bim modeler', 'architect', 'senior architect',
  'associate architect', 'principal architect',
  'landscape architect', 'interior architect',
  'interior designer', 'senior interior designer',
  'interior design consultant', 'urban planner',
  'town planner', 'urban designer',
  'real estate director', 'real estate manager',
  'property manager', 'property management executive',
  'facilities manager', 'facility supervisor',
  'building manager', 'building services engineer',
  'mep engineer', 'mep manager',
  'hvac engineer', 'plumbing engineer',
  'electrical site engineer', 'structural designer',
  'land surveyor', 'surveyor',
  'real estate consultant', 'property consultant',
  'real estate agent', 'property agent',
  'real estate broker', 'property broker',
  'leasing manager', 'leasing consultant',
  'property development manager', 'real estate developer',
  'valuation surveyor', 'property valuer',
  'land acquisition manager', 'land acquisition officer',

  // =====================================================
  // 14. HEALTHCARE, MEDICAL AND PHARMACEUTICAL
  // =====================================================
  'medical director', 'chief medical officer',
  'hospital director', 'hospital administrator',
  'hospital manager', 'medical superintendent',
  'deputy medical superintendent',
  'chief of medicine', 'medical officer',
  'senior medical officer', 'resident medical officer',
  'general practitioner', 'family physician',
  'physician', 'consultant physician',
  'specialist physician', 'surgeon',
  'consultant surgeon', 'cardiologist',
  'neurologist', 'dermatologist', 'psychiatrist',
  'orthopedic surgeon', 'orthopaedic surgeon',
  'pediatrician', 'paediatrician',
  'gynecologist', 'gynaecologist',
  'obstetrician', 'radiologist', 'anesthesiologist',
  'anaesthesiologist', 'oncologist', 'urologist',
  'ophthalmologist', 'ent specialist',
  'pathologist', 'microbiologist', 'nephrologist',
  'gastroenterologist', 'endocrinologist',
  'pulmonologist', 'rheumatologist',
  'emergency physician', 'intensivist',
  'dentist', 'dental surgeon', 'orthodontist',
  'oral surgeon', 'dental hygienist',
  'chief nursing officer', 'nursing superintendent',
  'nursing director', 'nursing manager',
  'nurse manager', 'head nurse', 'registered nurse',
  'staff nurse', 'nurse practitioner',
  'clinical nurse specialist', 'nursing officer',
  'nursing assistant', 'healthcare assistant',
  'midwife', 'paramedic', 'emergency medical technician',
  'physiotherapist', 'physical therapist',
  'occupational therapist', 'speech therapist',
  'speech language pathologist', 'clinical psychologist',
  'counseling psychologist', 'counsellor',
  'psychotherapist', 'clinical social worker',
  'dietitian', 'nutritionist', 'clinical dietitian',
  'pharmacist', 'clinical pharmacist',
  'hospital pharmacist', 'pharmacy manager',
  'pharmacy technician', 'pharmacy assistant',
  'pharmaceutical sales representative',
  'medical representative', 'medical sales executive',
  'medical affairs manager', 'medical science liaison',
  'clinical research associate', 'clinical research manager',
  'clinical trial coordinator', 'clinical data manager',
  'regulatory affairs manager', 'regulatory affairs executive',
  'pharmacovigilance officer', 'drug safety associate',
  'laboratory scientist', 'medical laboratory technologist',
  'medical laboratory technician', 'radiographer',
  'radiology technician', 'sonographer',
  'ultrasound technician', 'imaging technologist',
  'health information manager', 'medical records officer',
  'health and safety officer', 'public health officer',
  'epidemiologist', 'biostatistician',
  'biomedical scientist', 'medical coder',
  'medical billing specialist', 'healthcare consultant',
  'healthcare administrator', 'clinic manager',
  'practice manager', 'dental assistant',
  'veterinarian', 'veterinary doctor',
  'veterinary surgeon', 'veterinary officer',

  // =====================================================
  // 15. EDUCATION, TRAINING AND RESEARCH
  // =====================================================
  'chancellor', 'vice chancellor', 'pro vice chancellor',
  'university president', 'dean', 'associate dean',
  'assistant dean', 'academic dean',
  'director of education', 'director of academics',
  'principal', 'school principal', 'college principal',
  'vice principal', 'headmaster', 'headmistress',
  'school administrator', 'school manager',
  'college administrator', 'registrar',
  'university registrar', 'academic registrar',
  'controller of examinations', 'examination controller',
  'academic director', 'academic coordinator',
  'department chair', 'department chairman',
  'head of faculty', 'faculty dean',
  'professor', 'senior professor',
  'associate professor', 'assistant professor',
  'adjunct professor', 'visiting professor',
  'emeritus professor', 'lecturer',
  'senior lecturer', 'assistant lecturer',
  'instructor', 'senior instructor',
  'teacher', 'primary school teacher',
  'secondary school teacher', 'high school teacher',
  'kindergarten teacher', 'preschool teacher',
  'subject teacher', 'class teacher',
  'class coordinator', 'academic advisor',
  'academic adviser', 'education consultant',
  'educational counselor', 'school counselor',
  'career counselor', 'career advisor',
  'special education teacher', 'teaching assistant',
  'teaching fellow', 'research assistant',
  'research associate', 'research fellow',
  'senior research fellow', 'postdoctoral researcher',
  'postdoctoral fellow', 'research scientist',
  'research director', 'research manager',
  'laboratory instructor', 'lab manager',
  'curriculum developer', 'curriculum designer',
  'instructional designer', 'learning designer',
  'education officer', 'education coordinator',
  'training instructor', 'corporate trainer',
  'academic researcher', 'education researcher',
  'librarian', 'chief librarian',
  'library manager', 'library assistant',
  'school counselor', 'student affairs officer',
  'student services manager', 'admissions manager',
  'admissions officer', 'admissions counselor',
  'registrar officer', 'examination officer',

  // =====================================================
  // 16. LEGAL, COMPLIANCE AND CORPORATE GOVERNANCE
  // =====================================================
  'general counsel', 'chief legal officer',
  'legal director', 'legal manager',
  'head of legal', 'legal advisor',
  'legal adviser', 'legal counsel',
  'senior legal counsel', 'corporate counsel',
  'in-house counsel', 'legal consultant',
  'legal executive', 'legal officer',
  'legal assistant', 'legal secretary',
  'lawyer', 'advocate', 'attorney',
  'barrister', 'solicitor', 'litigation lawyer',
  'corporate lawyer', 'commercial lawyer',
  'tax lawyer', 'intellectual property lawyer',
  'patent attorney', 'trademark attorney',
  'paralegal', 'litigation associate',
  'legal associate', 'associate attorney',
  'senior associate', 'partner at law firm',
  'managing partner law firm',
  'arbitrator', 'mediator', 'legal researcher',
  'contract manager', 'contract specialist',
  'contract administrator', 'contracts officer',
  'compliance director', 'compliance manager',
  'compliance officer', 'compliance executive',
  'regulatory compliance manager',
  'regulatory affairs officer', 'risk and compliance manager',
  'governance manager', 'corporate governance officer',
  'data protection officer', 'dpo',
  'privacy officer', 'privacy counsel',
  'information governance manager',
  'anti-corruption officer', 'ethics officer',
  'internal control manager', 'fraud prevention manager',
  'company secretary', 'assistant company secretary',
  'corporate secretary', 'board secretary',
  'legal and compliance manager',
  'intellectual property manager',
  'patent analyst', 'trademark specialist',

  // =====================================================
  // 17. CUSTOMER-FACING RETAIL, E-COMMERCE AND HOSPITALITY
  // =====================================================
  'retail director', 'retail manager',
  'store manager', 'store supervisor',
  'assistant store manager', 'deputy store manager',
  'retail operations manager', 'retail executive',
  'retail sales associate', 'sales assistant',
  'shop manager', 'shop owner',
  'showroom manager', 'showroom executive',
  'store in charge', 'storekeeper',
  'cashier supervisor', 'front end manager',
  'category manager', 'category executive',
  'category analyst', 'merchandising manager',
  'merchandiser', 'visual merchandiser',
  'ecommerce manager', 'e-commerce manager',
  'ecommerce executive', 'e-commerce executive',
  'ecommerce specialist', 'marketplace manager',
  'marketplace executive', 'online sales manager',
  'online store manager', 'digital commerce manager',
  'catalog manager', 'catalog executive',
  'product listing executive', 'order fulfillment executive',
  'hotel general manager', 'hotel manager',
  'hotel operations manager', 'resort manager',
  'front office manager', 'front desk executive',
  'guest relations manager', 'guest relations executive',
  'concierge', 'concierge manager',
  'housekeeping manager', 'housekeeping supervisor',
  'food and beverage manager', 'f&b manager',
  'restaurant manager', 'restaurant supervisor',
  'restaurant owner', 'chef', 'executive chef',
  'head chef', 'sous chef', 'pastry chef',
  'kitchen manager', 'kitchen supervisor',
  'food service manager', 'catering manager',
  'banquet manager', 'bar manager',
  'travel manager', 'travel consultant',
  'travel agent', 'tour operator',
  'tour manager', 'tour guide',
  'reservation manager', 'reservation executive',
  'revenue manager hospitality', 'event coordinator',
  'airline station manager', 'airport manager',
  'flight attendant', 'cabin crew',
  'airline pilot', 'captain', 'first officer',
  'ground operations manager', 'ground staff',
  'customer experience manager hospitality',

  // =====================================================
  // 18. MEDIA, DESIGN, CONTENT AND ENTERTAINMENT
  // =====================================================
  'editor in chief', 'editor-in-chief',
  'managing editor', 'editor', 'senior editor',
  'associate editor', 'assistant editor',
  'sub editor', 'copy editor', 'news editor',
  'news director', 'news anchor', 'news reporter',
  'journalist', 'senior journalist',
  'correspondent', 'foreign correspondent',
  'photojournalist', 'columnist', 'publisher',
  'publishing director', 'publishing manager',
  'content director', 'content editor',
  'content strategist', 'content producer',
  'content creator', 'digital creator',
  'scriptwriter', 'screenwriter', 'author',
  'writer', 'technical writer', 'blogger',
  'podcast producer', 'radio presenter',
  'radio jockey', 'video producer',
  'film director', 'film producer',
  'executive producer', 'associate producer',
  'television director', 'television producer',
  'creative producer', 'production director',
  'production coordinator', 'production assistant',
  'camera operator', 'cinematographer',
  'director of photography', 'sound engineer',
  'audio engineer', 'sound designer',
  'music producer', 'composer', 'musician',
  'artist', 'illustrator', 'animator',
  '3d artist', '3d designer', 'visual effects artist',
  'vfx artist', 'game designer', 'game artist',
  'user experience researcher', 'ux researcher',
  'user interface designer', 'interaction designer',
  'service designer', 'design researcher',
  'design manager', 'design director',
  'creative strategist', 'brand consultant',

  // =====================================================
  // 19. AGRICULTURE, FOOD AND ENVIRONMENT
  // =====================================================
  'farm manager', 'farm supervisor',
  'farm owner', 'farmer', 'agronomist',
  'agricultural engineer', 'agricultural officer',
  'agriculture officer', 'agricultural consultant',
  'horticulturist', 'horticulture officer',
  'agricultural scientist', 'plant scientist',
  'soil scientist', 'soil conservation officer',
  'forestry officer', 'forest ranger',
  'forest officer', 'wildlife officer',
  'environmental manager', 'environmental officer',
  'environmental consultant', 'environmental scientist',
  'sustainability manager', 'sustainability officer',
  'esg manager', 'esg analyst',
  'climate change specialist', 'carbon analyst',
  'renewable energy engineer', 'solar engineer',
  'wind energy engineer', 'energy manager',
  'energy auditor', 'water resource engineer',
  'water treatment engineer', 'waste management manager',
  'food technologist', 'food scientist',
  'food production manager', 'food safety officer',
  'food quality manager', 'dairy technologist',
  'dairy farm manager', 'aquaculture manager',
  'fisheries officer', 'fishery manager',
  'veterinary officer', 'animal husbandry officer',
  'poultry farm manager', 'livestock manager',
  'plantation manager', 'estate manager',
  'tea plantation manager', 'rubber plantation manager',
  'coffee plantation manager', 'organic farming consultant',

  // =====================================================
  // 20. GOVERNMENT, PUBLIC SERVICE AND SECURITY
  // =====================================================
  'government officer', 'administrative officer',
  'civil servant', 'public administrator',
  'public relations officer', 'public information officer',
  'district collector', 'district magistrate',
  'deputy collector', 'sub collector',
  'tahsildar', 'tehsildar', 'revenue officer',
  'revenue inspector', 'village officer',
  'village administrative officer', 'vao',
  'municipal commissioner', 'municipal officer',
  'panchayat secretary', 'government secretary',
  'joint secretary', 'additional secretary',
  'deputy secretary', 'under secretary',
  'director of department', 'department secretary',
  'commissioner', 'additional commissioner',
  'deputy commissioner', 'assistant commissioner',
  'superintendent', 'superintendent of police',
  'police commissioner', 'deputy superintendent of police',
  'assistant superintendent of police',
  'inspector of police', 'sub inspector',
  'assistant sub inspector', 'head constable',
  'police constable', 'police officer',
  'investigation officer', 'investigating officer',
  'intelligence officer', 'security director',
  'security manager', 'security officer',
  'security supervisor', 'security guard',
  'chief security officer', 'loss prevention manager',
  'fire officer', 'fire chief', 'firefighter',
  'emergency management officer', 'disaster management officer',
  'military officer', 'army officer',
  'naval officer', 'air force officer',
  'commanding officer', 'commissioned officer',
  'defense analyst', 'defence analyst',
  'diplomat', 'consul', 'consul general',
  'ambassador', 'foreign service officer',
  'public policy analyst', 'policy advisor',
  'policy adviser', 'government relations manager',
  'public affairs manager', 'legislative affairs officer',
  'election officer', 'electoral registration officer',

  // =====================================================
  // 21. INSURANCE, CONSULTING AND PROFESSIONAL SERVICES
  // =====================================================
  'consultant', 'senior consultant',
  'principal consultant', 'associate consultant',
  'management consultant', 'strategy consultant',
  'business consultant', 'technology consultant',
  'it consultant', 'financial consultant',
  'hr consultant', 'marketing consultant',
  'operations consultant', 'process consultant',
  'implementation consultant', 'functional consultant',
  'technical consultant', 'independent consultant',
  'freelance consultant', 'freelancer',
  'independent contractor', 'contractor',
  'professional advisor', 'professional adviser',
  'business advisor', 'business adviser',
  'strategic advisor', 'strategic adviser',
  'insurance broker', 'insurance consultant',
  'insurance underwriter', 'insurance claims officer',
  'claims adjuster', 'insurance surveyor',
  'insurance investigator', 'loss adjuster',
  'risk consultant', 'actuarial consultant',
  'management accountant', 'valuation analyst',
  'business valuation specialist', 'insolvency practitioner',
  'restructuring consultant', 'turnaround manager',
  'outsourcing manager', 'bpo manager',
  'business process outsourcing manager',
  'knowledge manager', 'knowledge analyst',
  'research analyst', 'industry analyst',
  'economic analyst', 'economist',
  'policy researcher', 'market analyst',
  'technical assessor', 'certification auditor',
  'management system auditor', 'iso auditor',

  // =====================================================
  // 22. TELECOMMUNICATIONS AND NETWORK SERVICES
  // =====================================================
  'telecommunications engineer', 'telecom engineer',
  'telecom manager', 'telecom executive',
  'telecom technician', 'telecom analyst',
  'telecom operations manager', 'network operations manager',
  'noc engineer', 'noc analyst',
  'radio frequency engineer', 'rf engineer',
  'wireless engineer', 'fiber optic engineer',
  'fiber technician', 'optical network engineer',
  'mobile network engineer', 'radio network engineer',
  'rf planning engineer', 'telecom project manager',
  'telecom site engineer', 'telecom installation engineer',
  'field network engineer', 'transmission engineer',
  'switching engineer', 'voip engineer',
  'unified communications engineer',
  'telecommunications consultant',
  'satellite communications engineer',
  'broadband technician', 'network planning engineer',

  // =====================================================
  // 23. AUTOMOTIVE, AVIATION AND TRANSPORT
  // =====================================================
  'automotive technician', 'automotive mechanic',
  'auto mechanic', 'vehicle technician',
  'service advisor automotive', 'service manager automotive',
  'workshop manager', 'workshop supervisor',
  'automotive service manager', 'dealer principal',
  'automotive sales manager', 'car sales executive',
  'vehicle sales consultant', 'parts manager',
  'spare parts manager', 'parts executive',
  'automotive quality engineer', 'vehicle inspector',
  'fleet operations manager', 'fleet coordinator',
  'transport supervisor', 'transport officer',
  'logistics driver', 'delivery driver',
  'professional driver', 'chauffeur',
  'truck driver', 'bus driver',
  'train driver', 'locomotive pilot',
  'railway engineer', 'railway station master',
  'station manager', 'rail operations manager',
  'marine superintendent', 'ship captain',
  'ship master', 'marine surveyor',
  'port manager', 'port operations manager',
  'shipping agent', 'ship broker',
  'deck officer', 'marine officer',
  'chief engineer marine', 'marine technician',
  'aviation engineer', 'aircraft engineer',
  'aircraft maintenance engineer', 'ame',
  'aircraft mechanic', 'aviation safety officer',
  'flight operations manager', 'flight dispatcher',
  'air traffic controller', 'aviation consultant',

  // =====================================================
  // 24. FASHION, TEXTILES, JEWELLERY AND LUXURY GOODS
  // =====================================================
  'fashion designer', 'senior fashion designer',
  'fashion stylist', 'fashion merchandiser',
  'fashion buyer', 'fashion consultant',
  'textile engineer', 'textile designer',
  'textile technologist', 'garment technologist',
  'apparel production manager', 'garment production manager',
  'fashion production manager', 'pattern maker',
  'pattern master', 'fashion illustrator',
  'apparel merchandiser', 'export merchandiser',
  'garment quality controller', 'textile quality manager',
  'jewellery designer', 'jewelry designer',
  'jewellery store manager', 'jewelry store manager',
  'jewellery consultant', 'jewelry consultant',
  'gemologist', 'goldsmith', 'silversmith',
  'bench jeweler', 'jewellery manufacturer',
  'jewelry manufacturer', 'jewellery buyer',
  'jewelry buyer', 'diamond grader',
  'gemstone specialist', 'watchmaker',
  'luxury retail manager', 'luxury brand manager',
  'accessories designer', 'leather goods designer',
  'handbag designer', 'footwear designer',
  'shoe designer', 'product stylist',
  'artisan', 'craftsman', 'craftsperson',
  'handicraft designer', 'textile production manager',

  // =====================================================
  // 25. NONPROFIT, SOCIAL SERVICES AND COMMUNITY
  // =====================================================
  'executive director nonprofit', 'nonprofit director',
  'ngo director', 'ngo manager',
  'program director nonprofit', 'program manager nonprofit',
  'project officer ngo', 'field officer',
  'field coordinator', 'community development officer',
  'community manager', 'community outreach officer',
  'social worker', 'senior social worker',
  'case manager', 'case worker',
  'social services manager', 'charity manager',
  'fundraising manager', 'fundraising executive',
  'donor relations manager', 'development officer',
  'grant manager', 'grant writer',
  'volunteer coordinator', 'volunteer manager',
  'humanitarian officer', 'relief coordinator',
  'public health coordinator', 'advocacy manager',
  'policy advocacy officer', 'community liaison officer',

  // =====================================================
  // 26. STARTUPS, VENTURE CAPITAL AND INVESTMENTS
  // =====================================================
  'startup founder', 'startup co-founder',
  'startup advisor', 'startup mentor',
  'venture capital partner', 'venture capitalist',
  'venture capital analyst', 'venture capital associate',
  'investment partner', 'private equity partner',
  'private equity analyst', 'private equity associate',
  'private equity manager', 'angel investor',
  'investment director', 'investment associate',
  'investment principal', 'venture partner',
  'portfolio operations manager', 'incubation manager',
  'accelerator manager', 'startup program manager',
  'innovation manager', 'innovation director',
  'business incubator manager', 'corporate venture manager',
  'fundraising manager startup', 'investor relations manager',
  'investor relations executive', 'capital markets analyst',
  'equity research analyst', 'research associate finance',

  // =====================================================
  // 27. SPECIALIST, ENTRY-LEVEL AND OTHER TITLES
  // =====================================================
  'specialist', 'senior specialist', 'lead specialist',
  'principal specialist', 'associate specialist',
  'subject matter expert', 'sme',
  'expert', 'technical expert', 'industry expert',
  'coordinator', 'senior coordinator',
  'associate coordinator', 'project coordinator',
  'officer', 'senior officer', 'junior officer',
  'executive', 'senior executive', 'junior executive',
  'associate', 'senior associate', 'junior associate',
  'analyst', 'senior analyst', 'junior analyst',
  'associate analyst', 'lead analyst',
  'assistant', 'senior assistant', 'office assistant',
  'technical assistant', 'research assistant',
  'trainee', 'graduate trainee', 'intern',
  'management intern', 'technical intern',
  'apprentice', 'graduate apprentice',
  'field assistant', 'field executive',
  'field officer', 'field supervisor',
  'supervisor', 'senior supervisor',
  'team leader', 'team lead',
  'shift in charge', 'department in charge',
  'branch in charge', 'site in charge',
  'unit in charge', 'plant in charge',
  'consultant physician', 'resident',
  'fellow', 'research fellow',
  'practitioner', 'licensed practitioner',
  'registered professional', 'certified professional',
  'independent professional', 'self-employed',
  'proprietor', 'director', 'manager',
  'head', 'lead', 'principal', 'partner',
  'advisor', 'adviser', 'representative',
  'ambassador', 'agent', 'broker',
  'commission agent', 'franchise owner',
  'authorized signatory', 'authorized representative',
  'legal representative', 'company representative',
  'official representative', 'country representative',
  'regional representative', 'business representative',
  'corporate representative', 'trade representative',

  // =====================================================
  // 28. COMMON DEPARTMENT LABELS
  // Keep separate from actual job titles in production.
  // =====================================================
  'sales department', 'marketing department',
  'engineering department', 'finance department',
  'accounts department', 'human resources department',
  'hr department', 'administration department',
  'operations department', 'it department',
  'information technology department',
  'customer service department', 'customer support department',
  'business development department',
  'commercial department', 'export department',
  'import department', 'procurement department',
  'purchase department', 'purchasing department',
  'logistics department', 'supply chain department',
  'production department', 'manufacturing department',
  'quality control department', 'quality assurance department',
  'research and development department',
  'r&d department', 'legal department',
  'compliance department', 'security department',
  'technical department', 'maintenance department',
  'design department', 'product department',
  'project department', 'planning department',
  'warehouse department', 'dispatch department',
  'billing department', 'accounts payable department',
  'accounts receivable department', 'payroll department',
  'training department', 'recruitment department',
  'public relations department', 'communications department',
  'corporate affairs department', 'international business department',
  'retail department', 'service department',
  'after sales department', 'technical support department'
];

/**
 * Legal entity suffixes and company registration terms.
 * Match longer phrases before shorter ones.
 */
private readonly COMPANY_SUFFIXES: string[] = [
  // =====================================================
  // INDIA — COMMON COMPANY AND BUSINESS TYPES
  // =====================================================
  'private limited company',
  'private limited',
  'pvt limited',
  'pvt. limited',
  'pvt ltd',
  'pvt. ltd.',
  'pvt. ltd',
  'pvt ltd.',
  'pvtltd',
  'limited liability partnership',
  'limited liability company',
  'llp',
  'public limited company',
  'public limited',
  'public ltd',
  'opc private limited',
  'one person company',
  'one person company private limited',
  'section 8 company',
  'producer company limited',
  'farmer producer company',
  'nidhi limited',
  'microfinance limited',
  'cooperative society',
  'co-operative society',
  'cooperative limited',
  'co-operative limited',
  'registered society',
  'registered trust',
  'private company',
  'public company',
  'limited company',
  'limited',
  'ltd.',
  'ltd',
  'incorporated',
  'inc.',
  'inc',
  'company limited',
  'company ltd',
  'company pvt ltd',
  'and company',
  '& company',
  'and co.',
  '& co.',
  'co.',
  'co',
  'proprietorship',
  'sole proprietorship',
  'sole proprietor',
  'partnership firm',
  'registered partnership',
  'partnership',
  'firm',
  'enterprise',
  'enterprises',

  // =====================================================
  // UNITED STATES
  // =====================================================
  'limited liability company',
  'professional limited liability company',
  'series limited liability company',
  'low-profit limited liability company',
  'limited liability partnership',
  'limited partnership',
  'general partnership',
  'limited liability partnership',
  'professional corporation',
  'professional association',
  'public benefit corporation',
  'benefit corporation',
  'business corporation',
  'close corporation',
  'corporation',
  'corp.',
  'corp',
  'incorporated',
  'inc.',
  'inc',
  'company',
  'co.',
  'co',
  'l.l.c.',
  'l.l.c',
  'llc',
  'l.l.p.',
  'llp',
  'l.p.',
  'lp',
  'ltd.',
  'ltd',
  'p.c.',
  'pc',
  'p.a.',
  'pa',
  'pllc',
  'plc',
  'lllp',

  // =====================================================
  // UNITED KINGDOM AND IRELAND
  // =====================================================
  'private company limited by shares',
  'private company limited by guarantee',
  'public limited company',
  'community interest company',
  'limited by guarantee',
  'limited by shares',
  'company limited by guarantee',
  'company limited by shares',
  'limited partnership',
  'limited liability partnership',
  'limited liability company',
  'ltd.',
  'ltd',
  'limited',
  'plc',
  'llp',
  'cic',
  'ulc',
  'dac',
  'clg',
  'teo',
  'unlimited company',
  'charitable incorporated organisation',
  'cio',

  // =====================================================
  // CANADA
  // =====================================================
  'corporation',
  'incorporated',
  'limited',
  'limited liability company',
  'professional corporation',
  'ulc',
  'unlimited liability corporation',
  'inc.',
  'inc',
  'corp.',
  'corp',
  'ltd.',
  'ltd',
  'co.',
  'co',
  'ltée',
  'lte',
  's.e.n.c.',
  'sencrl',
  'llp',
  'lp',

  // =====================================================
  // AUSTRALIA AND NEW ZEALAND
  // =====================================================
  'proprietary limited',
  'proprietary limited company',
  'pty limited',
  'pty. limited',
  'pty ltd',
  'pty. ltd.',
  'pty ltd.',
  'pty',
  'limited',
  'ltd.',
  'ltd',
  'public company limited by shares',
  'public company limited by guarantee',
  'incorporated association',
  'incorporated',
  'inc.',
  'inc',
  'unincorporated joint venture',
  'no liability company',
  'nl',
  'llp',
  'lp',
  'company',
  'co.',

  // =====================================================
  // UAE AND GULF COUNTRIES
  // =====================================================
  'limited liability company',
  'limited liability co.',
  'llc',
  'l.l.c.',
  'l.l.c',
  'ltd.',
  'ltd',
  'private company limited',
  'public joint stock company',
  'private joint stock company',
  'pjsc',
  'prjsc',
  'joint stock company',
  'jsc',
  'federal establishment',
  'establishment',
  'sole establishment',
  'individual establishment',
  'general trading',
  'general trading llc',
  'free zone company',
  'free zone establishment',
  'free zone limited liability company',
  'fzc',
  'fze',
  'fzco',
  'fz-llc',
  'fz llc',
  'dmcc',
  'difc',
  'adgm',
  'rakez',
  'ifza',
  'masdar city',
  'branch of a foreign company',
  'representative office',
  'branch office',
  'holding company',
  'group of companies',
  'saoc',
  'saog',
  's.a.o.c.',
  's.a.o.g.',
  'wll',
  'w.l.l.',
  'bsc',
  'b.s.c.',
  'kscc',
  'ksc',
  'spc',
  'qpsc',
  'qfc',
  'qfc llc',
  'company limited by shares',

  // =====================================================
  // SAUDI ARABIA AND OTHER GULF MARKETS
  // =====================================================
  'limited liability company',
  'llc',
  'joint stock company',
  'closed joint stock company',
  'simplified joint stock company',
  'single person company',
  'branch of foreign company',
  'professional company',
  'general partnership',
  'limited partnership',
  'company',
  'establishment',
  'trading establishment',
  'contracting establishment',
  'trading company',
  'industrial company',
  'services company',
  'co.',
  'ltd.',
  'ltd',

  // =====================================================
  // GERMANY, AUSTRIA AND SWITZERLAND
  // =====================================================
  'gesellschaft mit beschränkter haftung',
  'gesellschaft mit beschrankter haftung',
  'aktiengesellschaft',
  'unternehmergesellschaft haftungsbeschränkt',
  'unternehmergesellschaft',
  'kommanditgesellschaft',
  'offene handelsgesellschaft',
  'eingetragener verein',
  'eingetragene genossenschaft',
  'gmbh & co. kg',
  'gmbh & co kg',
  'gmbh & co. kgaa',
  'gmbh & co kgaa',
  'gmbh',
  'mbh',
  'ug haftungsbeschränkt',
  'ug (haftungsbeschränkt)',
  'ag',
  'kg',
  'ohg',
  'e.v.',
  'ev',
  'e.g.',
  'eg',
  'kgaa',
  'gbr',
  'se',
  'sàrl',
  'sarl',
  'sagl',
  'sa',
  'ag',
  'gmbh',
  'ltd',

  // =====================================================
  // FRANCE, BELGIUM AND LUXEMBOURG
  // =====================================================
  'société à responsabilité limitée',
  'societe a responsabilite limitee',
  'société par actions simplifiée',
  'societe par actions simplifiee',
  'société anonyme',
  'societe anonyme',
  'société en nom collectif',
  'société en commandite simple',
  'société en commandite par actions',
  'entreprise unipersonnelle à responsabilité limitée',
  'société européenne',
  'sarl',
  's.a.r.l.',
  'sas',
  's.a.s.',
  'sa',
  's.a.',
  'sasu',
  'eurl',
  'snc',
  'sca',
  'scs',
  'se',
  'sprl',
  'bvba',
  'commv',
  'nv',
  'sa/nv',
  'srl',
  'asbl',
  'vzw',
  'sc',
  's.c.',
  'sàrl',
  'sarl',

  // =====================================================
  // NETHERLANDS
  // =====================================================
  'besloten vennootschap',
  'naamloze vennootschap',
  'vennootschap onder firma',
  'commanditaire vennootschap',
  'coöperatie',
  'cooperatie',
  'vereniging',
  'stichting',
  'bv',
  'b.v.',
  'nv',
  'n.v.',
  'vof',
  'cv',
  'co-op',
  'cooperative',

  // =====================================================
  // SPAIN AND PORTUGAL
  // =====================================================
  'sociedad limitada',
  'sociedad de responsabilidad limitada',
  'sociedad anónima',
  'sociedad anonima',
  'sociedad colectiva',
  'sociedad comanditaria',
  'sociedad limitada unipersonal',
  'sociedad anónima unipersonal',
  'sociedad anonima unipersonal',
  's.l.',
  'sl',
  's.l.u.',
  'slu',
  's.a.',
  'sa',
  's.coop.',
  'sc',
  'limitada',
  'sociedade por quotas',
  'sociedade anónima',
  'sociedade anonima',
  'sociedade unipessoal por quotas',
  'lda.',
  'lda',
  'ltda.',
  'ltda',
  'sgps',
  's.a.',
  'sa',

  // =====================================================
  // ITALY
  // =====================================================
  'società a responsabilità limitata',
  'societa a responsabilita limitata',
  'società per azioni',
  'societa per azioni',
  'società in accomandita semplice',
  'società in accomandita per azioni',
  'società in nome collettivo',
  'società cooperativa',
  's.r.l.',
  'srl',
  's.r.l.s.',
  'srls',
  's.p.a.',
  'spa',
  's.a.s.',
  'sas',
  's.n.c.',
  'snc',
  's.c.a.r.l.',
  'scarl',
  's.c.',
  'sc',
  's.a.p.a.',
  'sapa',

  // =====================================================
  // NORDIC COUNTRIES
  // =====================================================
  'aktiebolag',
  'publikt aktiebolag',
  'privat aktiebolag',
  'aktieselskab',
  'anpartsselskab',
  'aksjeselskap',
  'allmennaksjeselskap',
  'osakeyhtiö',
  'julkinen osakeyhtiö',
  'ekonomisk förening',
  'ideell förening',
  'ab',
  'a.b.',
  'oy',
  'oyj',
  'as',
  'a/s',
  'aps',
  'asa',
  'abp',
  'hf',
  'ehf',
  'ek',
  'kb',

  // =====================================================
  // EASTERN AND CENTRAL EUROPE
  // =====================================================
  'spółka z ograniczoną odpowiedzialnością',
  'spolka z ograniczona odpowiedzialnoscia',
  'spółka akcyjna',
  'spolka akcyjna',
  'sp. z o.o.',
  'sp zoo',
  'sp. z oo',
  's.a.',
  'sa',
  'sp.k.',
  'sp.k',
  'sp.j.',
  'sp.j',
  's.r.o.',
  'sro',
  'a.s.',
  'as',
  'k.s.',
  'zrt.',
  'kft.',
  'kft',
  'nyrt.',
  'zrt',
  'ooo',
  'o.o.o.',
  'zao',
  'pao',
  'ao',
  'gk',
  'srl',
  'doo',
  'd.o.o.',
  'ad',
  'eood',
  'ood',
  's.r.l.',
  'srl',

  // =====================================================
  // JAPAN, CHINA, HONG KONG, SINGAPORE AND ASIA
  // =====================================================
  'kabushiki kaisha',
  'godo kaisha',
  'yugen kaisha',
  'kk',
  'gk',
  'pty ltd',
  'private limited',
  'public limited',
  'private limited company',
  'public limited company',
  'limited',
  'ltd.',
  'ltd',
  'company limited',
  'co. limited',
  'co., ltd.',
  'co., ltd',
  'company ltd',
  'pte. ltd.',
  'pte ltd',
  'pte. limited',
  'pte',
  'plc',
  'berhad',
  'bhd.',
  'bhd',
  'sendirian berhad',
  'sdn. bhd.',
  'sdn bhd',
  'perseroan terbatas',
  'pt.',
  'pt',
  'tbk',
  'pt tbk',
  'limited company',
  'incorporated',
  'inc.',
  'inc',
  'corporation',
  'corp.',
  'corp',
  'company',
  'co.',
  'co',
  'llc',
  'llp',
  'lp',
  'joint stock company',
  'private company',
  'public company',
  'branch',
  'representative office',

  // =====================================================
  // SOUTH AFRICA AND AFRICA
  // =====================================================
  'proprietary limited',
  'pty ltd',
  'pty. ltd.',
  'limited',
  'ltd',
  'ltd.',
  'incorporated',
  'inc.',
  'inc',
  'public company limited',
  'non-profit company',
  'npc',
  'close corporation',
  'cc',
  'co-operative',
  'cooperative',
  'limited liability company',
  'llc',
  'plc',
  'company limited by shares',
  'company limited by guarantee',

  // =====================================================
  // LATIN AMERICA
  // =====================================================
  'sociedad anónima',
  'sociedad anonima',
  'sociedad de responsabilidad limitada',
  'sociedad por acciones simplificada',
  'sociedad limitada',
  'sociedad colectiva',
  'sociedad en comandita',
  's.a.',
  'sa',
  's.a. de c.v.',
  'sa de cv',
  's. de r.l.',
  's de rl',
  's.a.s.',
  'sas',
  's.r.l.',
  'srl',
  'ltda.',
  'ltda',
  'e.i.r.l.',
  'eirl',
  's.a.c.',
  'sac',
  's.a.a.',
  'saa',
  's.a.s.',
  'c.a.',
  'ca',
  'cia. ltda.',
  'cia ltda',
  'cía. ltda.',
  'limitada',
  'unipersonal',

  // =====================================================
  // INTERNATIONAL AND OTHER ENTITY TERMS
  // =====================================================
  'holding company',
  'holdings limited',
  'holdings ltd',
  'holdings inc',
  'holdings llc',
  'group limited',
  'group ltd',
  'group inc',
  'group llc',
  'international limited',
  'international ltd',
  'global limited',
  'global ltd',
  'registered company',
  'registered business',
  'registered enterprise',
  'incorporated company',
  'business corporation',
  'industrial corporation',
  'public corporation',
  'statutory corporation',
  'government corporation',
  'multinational corporation',
  'joint venture company',
  'joint venture',
  'consortium',
  'cooperative',
  'co-operative',
  'association',
  'foundation',
  'trust',
  'charitable trust',
  'nonprofit corporation',
  'non-profit corporation',
  'nonprofit organization',
  'non-profit organization',
  'not-for-profit company',
  'not for profit',
  'registered charity',
  'social enterprise',
  'public benefit company',
  'special purpose vehicle',
  'special purpose entity',
  'spv',
  'spe'
];


/**
 * Common business-name words.
 * These are NOT necessarily legal suffixes.
 */
private readonly COMPANY_NAME_KEYWORDS: string[] = [
  // General business terms
  'company', 'companies', 'corporation', 'corporate',
  'business', 'businesses', 'enterprise', 'enterprises',
  'group', 'groups', 'holding', 'holdings',
  'industries', 'industry', 'industrial',
  'trading', 'traders', 'trade',
  'commercial', 'commerce', 'ventures', 'venture',
  'partners', 'partnership', 'associates', 'association',
  'agency', 'agencies', 'organization', 'organisation',
  'solutions', 'services', 'service', 'consulting',
  'consultancy', 'consultants', 'advisory',
  'management', 'investments', 'investment',
  'capital', 'equity', 'fund', 'funds',
  'international', 'global', 'worldwide',
  'national', 'regional', 'united', 'universal',
  'premium', 'elite', 'prime', 'professional',
  'specialists', 'specialist', 'experts', 'expert',
  'resources', 'development', 'innovation',
  'ventures', 'projects', 'project',

  // Technology and digital
  'technology', 'technologies', 'tech',
  'information technology', 'it solutions',
  'infotech', 'software', 'software solutions',
  'digital', 'digital solutions', 'digital services',
  'systems', 'system', 'network', 'networks',
  'networking', 'communications', 'communication',
  'telecom', 'telecommunications', 'cyber',
  'cybersecurity', 'cloud', 'data', 'analytics',
  'artificial intelligence', 'automation',
  'robotics', 'engineering', 'engineers',
  'electronics', 'electronic', 'computers',
  'computer', 'computing', 'web', 'internet',
  'media', 'multimedia', 'interactive',
  'labs', 'lab', 'laboratories', 'research',
  'research and development', 'r&d',
  'platform', 'platforms', 'applications',
  'app development', 'digital transformation',

  // Finance and professional services
  'finance', 'financial', 'fintech',
  'accounting', 'accounts', 'audit', 'auditing',
  'tax', 'taxation', 'insurance', 'assurance',
  'banking', 'bank', 'wealth', 'wealth management',
  'credit', 'leasing', 'lending', 'mortgage',
  'consultants', 'consultancy', 'advisors',
  'advisers', 'legal', 'law', 'lawyers',
  'compliance', 'risk', 'trustees', 'fiduciary',
  'realty', 'real estate', 'properties', 'property',
  'investors', 'investor relations',

  // Manufacturing and engineering
  'manufacturing', 'manufacturers', 'factory',
  'factories', 'production', 'products',
  'product', 'machinery', 'machines',
  'equipment', 'equipments', 'tools',
  'components', 'industrials', 'automotive',
  'automobiles', 'motors', 'motor',
  'vehicles', 'vehicle', 'engineering works',
  'fabrication', 'fabricators', 'steel',
  'metals', 'metal', 'alloys', 'plastics',
  'plastic', 'chemicals', 'chemical',
  'materials', 'textiles', 'textile',
  'garments', 'apparel', 'fashion',
  'design', 'designs', 'precision',
  'electrical', 'mechanical', 'civil',
  'infrastructure', 'construction',
  'contractors', 'contracting', 'builders',
  'building', 'developers', 'development',
  'architects', 'architecture', 'interiors',

  // Logistics, trade and transportation
  'logistics', 'transport', 'transportation',
  'shipping', 'shipments', 'freight',
  'cargo', 'courier', 'express',
  'delivery', 'distribution', 'distributors',
  'distributor', 'wholesale', 'wholesalers',
  'retail', 'retailers', 'importers', 'imports',
  'exporters', 'exports', 'import export',
  'supply chain', 'warehousing', 'warehouse',
  'trucking', 'mobility', 'aviation',
  'airlines', 'marine', 'maritime',
  'port services', 'travel', 'tourism',
  'travels', 'tours', 'holidays',

  // Healthcare and life sciences
  'health', 'healthcare', 'medical',
  'medicals', 'medicine', 'medicines',
  'pharma', 'pharmaceutical', 'pharmaceuticals',
  'biotechnology', 'biotech', 'biomedical',
  'life sciences', 'clinical', 'diagnostics',
  'laboratory', 'laboratories', 'wellness',
  'fitness', 'hospital', 'hospitals',
  'clinics', 'clinic', 'dental', 'dentistry',
  'pharmacy', 'pharmacies', 'therapeutics',
  'veterinary', 'nutrition', 'nutraceuticals',

  // Energy, environment and resources
  'energy', 'power', 'electric power',
  'renewable energy', 'solar', 'wind energy',
  'oil', 'gas', 'petroleum', 'refinery',
  'mining', 'minerals', 'mineral',
  'resources', 'natural resources',
  'environment', 'environmental',
  'sustainability', 'water', 'water treatment',
  'waste management', 'recycling',
  'agriculture', 'agricultural', 'farming',
  'farms', 'farm', 'foods', 'food',
  'food processing', 'beverages', 'beverage',
  'dairy', 'seafood', 'fisheries',
  'plantations', 'plantation',

  // Consumer, retail and lifestyle
  'brands', 'brand', 'consumer',
  'consumer goods', 'fast moving consumer goods',
  'fmcg', 'ecommerce', 'e-commerce',
  'marketplace', 'shopping', 'stores',
  'store', 'supermarket', 'supermarkets',
  'fashion', 'lifestyle', 'luxury',
  'jewellery', 'jewelry', 'accessories',
  'gems', 'gemstones', 'diamonds',
  'gold', 'silver', 'watches', 'watch',
  'handicrafts', 'crafts', 'craft',
  'furniture', 'furnishings', 'home decor',
  'decor', 'interiors', 'appliances',
  'electronics retail', 'footwear', 'leather',
  'textile', 'apparel', 'garments',
  'cosmetics', 'beauty', 'personal care',
  'perfumes', 'fragrances',

  // Media, education and entertainment
  'media', 'entertainment', 'production house',
  'studios', 'studio', 'films', 'film',
  'pictures', 'broadcasting', 'broadcast',
  'publishing', 'publishers', 'publications',
  'communications', 'advertising', 'marketing',
  'branding', 'creative', 'design studio',
  'education', 'educational', 'learning',
  'training', 'academy', 'academies',
  'institute', 'institutes', 'institution',
  'university', 'universities', 'school',
  'schools', 'college', 'colleges',
  'e-learning', 'edtech', 'research institute',
  'sports', 'gaming', 'games', 'interactive media',

  // Hospitality and property
  'hospitality', 'hotels', 'hotel',
  'resorts', 'resort', 'restaurants',
  'restaurant', 'catering', 'cafes', 'cafe',
  'food services', 'events', 'event management',
  'exhibitions', 'conventions', 'banquets',
  'properties', 'property', 'realty',
  'real estate', 'developers', 'development',
  'infrastructure', 'facilities', 'facility management',

  // People, outsourcing and support
  'human resources', 'hr solutions',
  'recruitment', 'staffing', 'talent',
  'manpower', 'employment', 'outsourcing',
  'business process outsourcing', 'bpo',
  'knowledge process outsourcing', 'kpo',
  'customer service', 'customer support',
  'call center', 'call centre',
  'contact center', 'contact centre',
  'back office', 'shared services',
  'professional services', 'managed services',
  'technical support', 'field services',

  // Other commonly used words
  'foundation', 'trust', 'charity',
  'nonprofit', 'non-profit', 'association',
  'society', 'cooperative', 'co-operative',
  'federation', 'council', 'chamber',
  'union', 'initiative', 'foundation',
  'projects', 'contractors', 'contracting',
  'enterprises', 'ventures', 'holdings',
  'international', 'global', 'worldwide',
  'multinational', 'regional', 'national',
  'trading company', 'general trading',
  'general trading company', 'commercial trading',
  'establishment', 'est.', 'works',
  'workshop', 'workshops', 'industries',
  'associates', 'partners', 'group'
];


/**
 * Common business-name endings and trading-name terms.
 * Keep this separate from legal suffixes.
 */
private readonly COMPANY_NAME_ENDINGS: string[] = [
  'technologies', 'technology', 'solutions',
  'systems', 'group', 'holdings', 'enterprises',
  'industries', 'services', 'consulting',
  'consultancy', 'global', 'international',
  'studios', 'labs', 'ventures', 'agency',
  'works', 'associates', 'partners', 'logistics',
  'pharmaceuticals', 'healthcare', 'health',
  'infotech', 'software', 'media',
  'communications', 'network', 'networks',
  'digital', 'trading', 'traders',
  'engineering', 'manufacturing', 'industries',
  'exports', 'imports', 'distribution',
  'trading company', 'general trading',
  'contracting', 'construction', 'developers',
  'properties', 'realty', 'capital',
  'investments', 'finance', 'financial',
  'consultants', 'advisors', 'advisers',
  'marketing', 'advertising', 'creative',
  'design', 'education', 'academy',
  'institute', 'foundation', 'association',
  'enterprise', 'business solutions',
  'management', 'resources', 'products',
  'product solutions', 'innovations',
  'innovation', 'research', 'research labs',
  'automation', 'robotics', 'electronics',
  'automotive', 'motors', 'industrials',
  'energy', 'power', 'renewables',
  'foods', 'food products', 'beverages',
  'agro', 'agriculture', 'textiles',
  'garments', 'fashion', 'jewellery',
  'jewelry', 'diamonds', 'luxury',
  'retail', 'ecommerce', 'e-commerce',
  'hospitality', 'hotels', 'resorts',
  'transport', 'transportation', 'freight',
  'shipping', 'courier', 'express',
  'security', 'safety', 'compliance',
  'insurance', 'assurance', 'banking',
  'ventures', 'corporation', 'company',
  'co.', 'limited', 'ltd', 'inc',
  'inc.', 'llc', 'llp', 'plc', 'gmbh',
  'sarl', 'sàrl', 'sas', 'sa', 'bv',
  'nv', 'pty ltd', 'pte ltd', 'fzc', 'fze',
  'dmcc', 'wll', 'bsc', 'pjsc', 'spc'
];


  // Countries & Normalization Map
  private readonly COUNTRY_MAP: Record<string, string> = {
    'usa': 'USA',
    'us': 'USA',
    'united states': 'USA',
    'united states of america': 'USA',
    'uk': 'UK',
    'united kingdom': 'UK',
    'great britain': 'UK',
    'england': 'UK',
    'uae': 'UAE',
    'united arab emirates': 'UAE',
    'india': 'IND',
    'canada': 'CAN',
    'australia': 'AUS',
    'germany': 'DEU',
    'france': 'FRA',
    'singapore': 'SGP',
    'japan': 'JPN',
    'netherlands': 'NLD',
    'switzerland': 'CHE',
    'saudi arabia': 'KSA',
    'ksa': 'KSA',
    'qatar': 'QAT',
    'malaysia': 'MYS',
    'china': 'CHN',
    'spain': 'ESP',
    'italy': 'ITA',
    'brazil': 'BRA',
    'south africa': 'ZAF',
    'new zealand': 'NZL',
    'ireland': 'IRL',
    'sweden': 'SWE',
    'norway': 'NOR',
    'denmark': 'DNK',
    'finland': 'FIN',
    'kuwait': 'KWT',
    'oman': 'OMN',
    'bahrain': 'BHR'
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

    // ==========================================
    // 0. PRE-FLIGHT NON-BUSINESS-CARD CHECK
    // ==========================================
    if (this.isNonBusinessCardDocument(rawText, lines)) {
      return {
        confidenceScore: 0,
        isLowConfidence: true,
        rawText: rawText,
        lines: lines
      };
    }

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
      const mobileCandidates = phoneCandidates.filter(p => p.type === 'mobile');
      const landlineCandidates = phoneCandidates.filter(p => p.type === 'landline');
      const genericCandidates = phoneCandidates.filter(p => p.type === 'generic');

      // 1. Assign Mobile Number
      if (mobileCandidates.length > 0) {
        result.contactMobileNumber = mobileCandidates[0].number;
      } else if (genericCandidates.length > 0) {
        result.contactMobileNumber = genericCandidates[0].number;
      }

      // 2. Assign Landline / Office Number
      if (landlineCandidates.length > 0) {
        result.landline = landlineCandidates[0].number;
      } else if (mobileCandidates.length > 1) {
        // When multiple mobile numbers are on the card and no landline was specified,
        // preserve the second mobile number as secondary contact in landline so it's not lost
        result.landline = mobileCandidates[1].number;
      } else if (genericCandidates.length > 1 && !result.landline) {
        result.landline = genericCandidates[1].number;
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
    // Priority A: Explicit Company Suffix or Company Name Ending
    for (let i = 0; i < lines.length; i++) {
      if (lineUsage.get(i)?.has('name') || lineUsage.get(i)?.has('designation') || lineUsage.get(i)?.has('email') || lineUsage.get(i)?.has('phone') || lineUsage.get(i)?.has('website')) {
        continue;
      }
      if (this.hasCompanySuffix(lines[i])) {
        if (!this.isValidCompanyCandidate(lines[i])) continue;
        let fullCompany = lines[i];

        // Look-ahead: If next line also belongs to the company name (e.g. "CANADIAN SYSTEMS" + "CONTRACTING COMPANY")
        if (i + 1 < lines.length && !lineUsage.get(i + 1)?.has('name') && !lineUsage.get(i + 1)?.has('designation') && !lineUsage.get(i + 1)?.has('email') && !lineUsage.get(i + 1)?.has('phone') && !lineUsage.get(i + 1)?.has('website')) {
          if ((this.hasCompanySuffix(lines[i + 1]) || this.hasCompanyKeyword(lines[i + 1])) && this.isValidCompanyCandidate(lines[i + 1])) {
            fullCompany += ' ' + lines[i + 1];
            markUsage(i + 1, 'company');
          }
        }

        // Look-behind: If previous line is an unclaimed prefix (e.g. "CANADIAN" + "CONTRACTING COMPANY")
        if (i > 0 && !lineUsage.get(i - 1)?.has('name') && !lineUsage.get(i - 1)?.has('designation') && !lineUsage.get(i - 1)?.has('email') && !lineUsage.get(i - 1)?.has('phone') && !lineUsage.get(i - 1)?.has('website')) {
          const prev = lines[i - 1];
          if (this.isValidCompanyCandidate(prev) && !this.isTagline(prev) && !/^[A-Z]{1,3}$/.test(prev.trim())) {
            fullCompany = prev + ' ' + fullCompany;
            markUsage(i - 1, 'company');
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

  /**
   * Pre-splits a phone line when multiple phone numbers or repeated labels exist on the same line.
   * e.g. "mob. 0531170206 - 0503935472" -> ["mob. 0531170206", "0503935472"]
   * or "Tel: 011 234 5678 / Mob: 050 123 4567" -> ["Tel: 011 234 5678", "Mob: 050 123 4567"]
   */
  private splitPhoneLineSegments(line: string): string[] {
    // 1. If line has multiple phone labels (e.g. "Tel: ... Mob: ..."), split before subsequent labels
    const labelSplitRegex = /(?<=[0-9)\s])(?=(?:\b(?:mob|mobile|cell|tel|telephone|phone|fax|office|off|dir)\b[:.\-\s]?))/i;
    const parts = line.split(labelSplitRegex).map(p => p.trim()).filter(p => p.length > 0);

    // 2. For each part, split by explicit multiple-number separators: /, |, \, ;, or comma
    const delimiterRegex = /\s*(?:\/|\||\\|;|\s,\s*)\s*/;
    const subParts: string[] = [];
    for (const part of parts) {
      const splitByDelim = part.split(delimiterRegex).map(s => s.trim()).filter(s => s.length > 0);
      subParts.push(...splitByDelim);
    }

    // 3. Check for hyphen/dash separators between two distinct numbers
    // e.g. "0531170206 - 0503935472" or "0531170206-0503935472"
    const finalSegments: string[] = [];
    for (const part of subParts) {
      // Split on dash/hyphen only if both sides have at least 7 digits (excluding extensions)
      const dashMatch = part.match(/^([\s\S]+?)\s*[-–—]\s*([\s\S]+)$/);
      if (dashMatch) {
        const leftDigits = dashMatch[1].replace(/\D/g, '');
        const rightWithoutExt = dashMatch[2].replace(/\b(?:ext|x|extension|extn)\b.*$/i, '');
        const rightDigits = rightWithoutExt.replace(/\D/g, '');

        if (leftDigits.length >= 7 && rightDigits.length >= 7) {
          finalSegments.push(dashMatch[1].trim());
          finalSegments.push(dashMatch[2].trim());
          continue;
        }
      }
      finalSegments.push(part);
    }

    return finalSegments.filter(s => s.length > 0);
  }

  /**
   * Refines a phone candidate and classifies it with deep awareness of Saudi (CST/CITC) numbering plans:
   * - Saudi Mobile: 05xxxxxxxx, +966 5xxxxxxxx (9-10 digits)
   * - Saudi Landline: 011 (Riyadh), 012 (Makkah/Jeddah), 013 (Eastern), 014 (Madinah/Tabuk), 016 (Qassim/Hail), 017 (South)
   * - Saudi Unified: 9200xxxxx (9 digits)
   * - Saudi Toll-Free: 800xxxxxxx (10 digits)
   * - Extension handling: removes alphabetical words so Angular phoneValidator passes without error
   */
  private classifyAndRefinePhone(
    rawMatch: string,
    segment: string
  ): { number: string; type: 'mobile' | 'landline' | 'generic' } | null {
    // Clean leading/trailing punctuation but preserve internal spaces, parentheses, hyphens, and leading +
    let cleanNumber = rawMatch.trim().replace(/^[^0-9+]+|[^0-9]+$/g, '');

    // Extract and handle extensions: e.g. " - Ext. 210" or " Ext: 210" or " x210"
    let extensionDigits = '';
    const extMatch = segment.match(/\b(?:ext|x|extension|extn)[:.\s]*(\d{1,5})\b/i);
    if (extMatch) {
      extensionDigits = extMatch[1];
      // Remove any alphabetical extension words from cleanNumber so phoneValidator passes without error
      cleanNumber = cleanNumber.replace(/[-.\s]*(?:ext|x|extension|extn)[:.\s]*\d{1,5}/i, '').trim();
    }

    // Strip redundant domestic (0) in international formats, e.g. "+966 (0) 16300777" -> "+966 16300777"
    if (/^(?:\+|00)?966\s*\(0\)/i.test(cleanNumber)) {
      cleanNumber = cleanNumber.replace(/((?:\+|00)?966)\s*\(0\)\s*/i, '$1 ');
    }

    const digitsOnly = cleanNumber.replace(/\D/g, '');

    // Valid phone numbers are typically 7 to 15 digits
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return null;
    }

    // Discard pure 6-digit postal zip codes
    if (digitsOnly.length <= 6) {
      return null;
    }

    // Format extension cleanly without English letters: e.g. "+966 16 300777 - 210"
    if (extensionDigits && !cleanNumber.endsWith(extensionDigits)) {
      cleanNumber = `${cleanNumber} - ${extensionDigits}`;
    }

    // Context cues on the segment
    const hasMobileCue = this.MOBILE_LABEL_REGEX.test(segment);
    const hasLandlineCue = this.LANDLINE_LABEL_REGEX.test(segment);
    const hasFaxCue = this.FAX_LABEL_REGEX.test(segment);
    const hasExtension = !!extensionDigits;

    // ========================================================
    // SAUDI NUMBER CLASSIFICATION (CST / CITC Numbering Plan)
    // ========================================================
    let isSaudiMobile = false;
    let isSaudiLandline = false;

    if (digitsOnly.startsWith('966') || digitsOnly.startsWith('00966')) {
      const nationalDigits = digitsOnly.replace(/^(?:00)?966/, '');
      // Saudi Mobile: starts with 5 (9 digits national, e.g. 5xxxxxxxx)
      if (nationalDigits.startsWith('5') && nationalDigits.length === 9) {
        isSaudiMobile = true;
      }
      // Saudi Geographic Landlines: 11 (Riyadh), 12 (Makkah/Jeddah), 13 (Eastern), 14 (Madinah/Tabuk), 16 (Qassim/Hail), 17 (South)
      else if (/^1[123467]/.test(nationalDigits) || nationalDigits.startsWith('1')) {
        isSaudiLandline = true;
      }
      // Saudi Unified (9200) or Toll-Free (800)
      else if (nationalDigits.startsWith('9200') || nationalDigits.startsWith('800')) {
        isSaudiLandline = true;
      }
    } else {
      // Domestic Saudi formats:
      // Mobile: starts with 05 (10 digits: 05xxxxxxxx) or 5 (9 digits)
      if ((digitsOnly.startsWith('05') && digitsOnly.length === 10) || (digitsOnly.startsWith('5') && digitsOnly.length === 9)) {
        isSaudiMobile = true;
      }
      // Geographic landlines: 011, 012, 013, 014, 016, 017 (9-10 digits)
      else if (/^0?1[123467]/.test(digitsOnly) && digitsOnly.length >= 8 && digitsOnly.length <= 10) {
        isSaudiLandline = true;
      }
      // Unified corporate 9200 (9 digits)
      else if (digitsOnly.startsWith('9200') && digitsOnly.length === 9) {
        isSaudiLandline = true;
      }
      // Toll-free 800 (10 digits)
      else if (digitsOnly.startsWith('800') && digitsOnly.length === 10) {
        isSaudiLandline = true;
      }
    }

    // Determine candidate type with Saudi priority
    let type: 'mobile' | 'landline' | 'generic' = 'generic';

    if (isSaudiMobile) {
      type = 'mobile';
    } else if (isSaudiLandline || hasExtension) {
      type = 'landline';
    } else if (hasMobileCue) {
      type = 'mobile';
    } else if (hasLandlineCue || hasFaxCue) {
      type = 'landline';
    }

    return { number: cleanNumber, type };
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

      // Pre-split line if it contains multiple phone numbers or multiple labels
      const segments = this.splitPhoneLineSegments(line);

      segments.forEach(segment => {
        let searchTarget = segment;
        if (this.MOBILE_LABEL_REGEX.test(segment) || this.LANDLINE_LABEL_REGEX.test(segment) || this.FAX_LABEL_REGEX.test(segment)) {
          searchTarget = segment.replace(/^[A-Za-z\s]+[:.\-]/, '').trim();
        }

        const matches = searchTarget.match(this.PHONE_CANDIDATE_REGEX);
        if (!matches) return;

        matches.forEach(rawMatch => {
          const refined = this.classifyAndRefinePhone(rawMatch, segment);
          if (!refined) return;

          // Prevent duplicate numbers using core digits key
          const coreDigits = refined.number.replace(/\D/g, '');
          if (seenDigits.has(coreDigits)) return;
          seenDigits.add(coreDigits);

          results.push(refined);
          markUsage(idx, 'phone');
        });
      });
    });

    return results;
  }

  private findDesignation(line: string): string | null {
    const trimmed = line.trim();
    if (trimmed.length < 2 || trimmed.length > 70) return null;
    if (/\d{4,}/.test(trimmed)) return null; // Reject lines with long numbers

    const lower = trimmed.toLowerCase();

    // Avoid matching 2-letter state codes in addresses or cities as designations
    if (this.ADDRESS_KEYWORDS_REGEX.test(lower) || this.KNOWN_CITIES.some(c => lower.includes(c))) {
      return null;
    }

    for (const desig of this.COMMON_DESIGNATIONS) {
      if (desig.length <= 3) {
        if (lower === desig || lower.startsWith(desig + ' ') || lower.endsWith(' ' + desig) || lower.includes(' ' + desig + ' ')) {
          return trimmed;
        }
        continue;
      }

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
    const hasSuffix = this.COMPANY_SUFFIXES.some(suffix => {
      const regex = new RegExp(`(^|[^a-zA-Z])${this.escapeRegex(suffix)}([^a-zA-Z]|$)`, 'i');
      return regex.test(lower);
    });
    if (hasSuffix) return true;

    return this.COMPANY_NAME_ENDINGS.some(ending => {
      const regex = new RegExp(`(^|[^a-zA-Z])${this.escapeRegex(ending)}([^a-zA-Z]|$)`, 'i');
      return regex.test(lower);
    });
  }

  private hasCompanyKeyword(line: string): boolean {
    const lower = line.toLowerCase();
    return this.COMPANY_NAME_KEYWORDS.some(kw => {
      const regex = new RegExp(`(^|[^a-zA-Z])${this.escapeRegex(kw)}([^a-zA-Z]|$)`, 'i');
      return regex.test(lower);
    });
  }

  private isTagline(line: string): boolean {
    if (!line) return false;
    const clean = line.trim();
    return /^(?:pioneers?|leaders?|specialists?|excellence|your partner|delivering|empowering|innovating)\s+in\b/i.test(clean);
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
    if (this.isTagline(clean)) return false;

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

  private isNonBusinessCardDocument(rawText: string, lines: string[]): boolean {
    if (!rawText) return true;

    // 1. Check strong document exclusion patterns
    for (const pattern of this.NON_BUSINESS_CARD_PATTERNS) {
      if (pattern.test(rawText)) {
        return true;
      }
    }

    // 2. Line count / word count check
    // Business cards are physically small cards typically containing between 3 and 18 lines
    if (lines.length > 25) {
      return true;
    }

    const words = rawText.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length > 130) {
      return true;
    }

    // 3. Multi-line item pricing check (e.g. invoices, receipts with 2 or more price lines)
    const currencyMatches = rawText.match(/(?:[$€£¥₹]|USD|EUR|AED|SAR|INR)\s*\d+(?:\.\d{2})?/gi);
    if (currencyMatches && currencyMatches.length >= 2) {
      return true;
    }

    return false;
  }
}

