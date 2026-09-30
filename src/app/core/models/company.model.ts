import { BrandResponse } from './brand.model';

export interface CompanyRequest {
  companyName: string;
  email: string;
  landline?: string;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
  description?: string;
  status: string;
  businessCard?: string;
  contactName?: string;
  contactDesignation?: string;
  contactEmail?: string;
  contactMobileNumber?: string;
  brandIds?: number[];
}

export interface CompanyResponse {
  id: number;
  companyName: string;
  email: string;
  landline?: string;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
  description?: string;
  status: string;
  businessCard?: string;
  contactName?: string;
  contactDesignation?: string;
  contactEmail?: string;
  contactMobileNumber?: string;
  createdAt?: string;
  updatedAt?: string;
  brandIds?: number[];
  brands?: BrandResponse[];
}
