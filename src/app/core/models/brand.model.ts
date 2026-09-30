export interface BrandRequest {
  brandName: string;
  isFeatured: boolean;
  featured?: boolean;
  brandLogo?: string;
}

export interface BrandResponse {
  id: number;
  brandName: string;
  brandLogo?: string;
  isFeatured?: boolean;
  featured?: boolean;
}
