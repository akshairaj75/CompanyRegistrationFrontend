
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CategoryRequest, CategoryResponse } from '../models/category.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/categories`;
  private readonly fileBaseUrl = environment.fileUrl;

  /**
   * Fetch all categories
   */
  getAllCategories(): Observable<CategoryResponse[]> {
    return this.http.get<CategoryResponse[]>(`${this.apiUrl}/get-all`);
  }

  /**
   * Fetch single category by ID
   */
  getCategoryById(id: number): Observable<CategoryResponse> {
    return this.http.get<CategoryResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create new category with optional image file
   */
  createCategory(categoryData: CategoryRequest, file?: File | null): Observable<CategoryResponse> {
    const formData = new FormData();
    const jsonBlob = new Blob([JSON.stringify(categoryData)], { type: 'application/json' });
    formData.append('data', jsonBlob);
    formData.append('categoryRequestDto', jsonBlob);

    if (file) {
      formData.append('file', file, file.name);
    }

    return this.http.post<CategoryResponse>(`${this.apiUrl}/create`, formData);
  }

  /**
   * Update category by ID with optional image file
   */
  updateCategory(id: number, categoryData: CategoryRequest, file?: File | null): Observable<CategoryResponse> {
    const formData = new FormData();
    const jsonBlob = new Blob([JSON.stringify(categoryData)], { type: 'application/json' });
    formData.append('data', jsonBlob);
    formData.append('categoryRequestDto', jsonBlob);

    if (file) {
      formData.append('file', file, file.name);
    }

    return this.http.put<CategoryResponse>(`${this.apiUrl}/update/${id}`, formData);
  }

  /**
   * Delete category by ID
   */
  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/delete/${id}`);
  }

  /**
   * Resolve category image URL
   */
  getFileUrl(path?: string): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return `${this.fileBaseUrl}${cleanPath}`;
  }
}
