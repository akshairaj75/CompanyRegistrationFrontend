export interface ProductRequest {
  name: string;
  description?: string;
  image?: string;
  isFeatured: boolean;
  featured?: boolean;
  brandId: number;
  categoryId: number;
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
  createdAt?: string;
  updatedAt?: string;
}
