import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BrandRequest, BrandResponse } from '../models/brand.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class BrandService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/brands`;
  private readonly fileBaseUrl = environment.fileUrl;

  /**
   * Fetch all registered brands
   */
  getAllBrands(): Observable<BrandResponse[]> {
    return this.http.get<BrandResponse[]>(`${this.apiUrl}/get-all`);
  }

  /**
   * Fetch a single brand by ID
   */
  getBrandById(id: number): Observable<BrandResponse> {
    return this.http.get<BrandResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Register a new brand with optional logo image file
   */
  createBrand(brandData: BrandRequest, file?: File | null): Observable<BrandResponse> {
    const formData = new FormData();
    const jsonBlob = new Blob([JSON.stringify(brandData)], { type: 'application/json' });
    formData.append('data', jsonBlob);
    formData.append('brandRequestDto', jsonBlob);

    if (file) {
      formData.append('file', file, file.name);
    }

    return this.http.post<BrandResponse>(`${this.apiUrl}/create`, formData);
  }

  /**
   * Update brand by ID with optional new logo file
   */
  updateBrand(id: number, brandData: BrandRequest, file?: File | null): Observable<BrandResponse> {
    const formData = new FormData();
    const jsonBlob = new Blob([JSON.stringify(brandData)], { type: 'application/json' });
    formData.append('data', jsonBlob);
    formData.append('brandRequestDto', jsonBlob);

    if (file) {
      formData.append('file', file, file.name);
    }

    return this.http.put<BrandResponse>(`${this.apiUrl}/update/${id}`, formData);
  }

  /**
   * Delete brand by ID
   */
  deleteBrand(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/delete/${id}`);
  }

  /**
   * Resolve brand logo full URL
   */
  getFileUrl(path?: string): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return `${this.fileBaseUrl}${cleanPath}`;
  }
}
