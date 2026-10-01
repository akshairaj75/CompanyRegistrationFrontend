export interface CategoryRequest {
  name: string;
  categoryImage?: string;
  parentId?: number | null;
}

export interface CategoryResponse {
  id: number;
  name: string;
  categoryImage?: string;
  parentId?: number | null;
  parentName?: string;
}
