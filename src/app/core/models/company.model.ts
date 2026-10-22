import { BrandResponse } from './brand.model';
import { ProductResponse } from './product.model';

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
  productIds?: number[];
  existingBusinessCards?: string[];
  userId?: number;
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
  businessCards?: string[];
  contactName?: string;
  contactDesignation?: string;
  contactEmail?: string;
  contactMobileNumber?: string;
  createdAt?: string;
  updatedAt?: string;
  brandIds?: number[];
  brands?: BrandResponse[];
  productIds?: number[];
  products?: ProductResponse[];
  userId?: number;
  userEmail?: string;
  userFullName?: string;
}

export interface BusinessCardItem {
  id: string;
  name: string;
  url?: string;
  path?: string;
  isPdf: boolean;
  isExisting: boolean;
  file?: File;
  size?: number;
}
