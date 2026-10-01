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
