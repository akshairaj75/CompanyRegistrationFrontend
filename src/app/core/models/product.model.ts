export interface ProductRequest {
  name: string;
  description?: string;
  image?: string;
  isFeatured: boolean;
  featured?: boolean;
  brandId: number;
  categoryId: number;
  subCategoryId?: number | null;
}

export interface ProductResponse {
  id: number;
  name: string;
  description?: string;
  image?: string;
  isFeatured?: boolean;
  featured?: boolean;
  brandId: number;
  brandName?: string;
  categoryId: number;
  categoryName?: string;
  subCategoryId?: number | null;
  subCategoryName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScrapedProduct {
  name: string;
  description?: string;
  imageUrl?: string;
  price?: string;
  productUrl?: string;
  matchedCatalogProductId?: number | null;
}

export interface ScrapeProductsResponse {
  websiteUrl: string;
  scannedUrl: string;
  totalDiscovered: number;
  products: ScrapedProduct[];
  strategyUsed: string;
  message: string;
}
