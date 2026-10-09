export interface BusinessCardScanResult {
  companyName?: string;
  contactName?: string;
  contactDesignation?: string;
  email?: string;
  contactEmail?: string;
  contactMobileNumber?: string;
  landline?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  description?: string;
  confidenceScore: number;
  rawText: string;
  lines: string[];
}

export interface GoogleVisionAnnotateRequest {
  requests: Array<{
    image: {
      content: string; // base64 encoded
    };
    features: Array<{
      type: string;
      maxResults?: number;
    }>;
  }>;
}

export interface GoogleVisionResponse {
  responses: Array<{
    fullTextAnnotation?: {
      text: string;
    };
    textAnnotations?: Array<{
      description: string;
      locale?: string;
    }>;
    error?: {
      code: number;
      message: string;
      status: string;
    };
  }>;
}
