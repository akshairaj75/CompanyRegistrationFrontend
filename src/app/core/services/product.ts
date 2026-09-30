import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProductRequest, ProductResponse } from '../models/product.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/products`;
  private readonly fileBaseUrl = environment.fileUrl;

  /**
   * Fetch all registered products
   */
  getAllProducts(): Observable<ProductResponse[]> {
    return this.http.get<ProductResponse[]>(`${this.apiUrl}/get-all`);
  }

  /**
   * Fetch single product by ID
   */
  getProductById(id: number): Observable<ProductResponse> {
    return this.http.get<ProductResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create new product with required Category and Brand, plus optional image file
   */
  createProduct(productData: ProductRequest, file?: File | null): Observable<ProductResponse> {
    const formData = new FormData();
    const jsonBlob = new Blob([JSON.stringify(productData)], { type: 'application/json' });
    formData.append('data', jsonBlob);
    formData.append('productRequestDto', jsonBlob);

    if (file) {
      formData.append('file', file, file.name);
    }

    return this.http.post<ProductResponse>(`${this.apiUrl}/create`, formData);
  }

  /**
   * Update product by ID with optional new image file
   */
  updateProduct(id: number, productData: ProductRequest, file?: File | null): Observable<ProductResponse> {
    const formData = new FormData();
    const jsonBlob = new Blob([JSON.stringify(productData)], { type: 'application/json' });
    formData.append('data', jsonBlob);
    formData.append('productRequestDto', jsonBlob);

    if (file) {
      formData.append('file', file, file.name);
    }

    return this.http.put<ProductResponse>(`${this.apiUrl}/update/${id}`, formData);
  }

  /**
   * Delete product by ID
   */
  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/delete/${id}`);
  }

  /**
   * Resolve product image full URL
   */
  getFileUrl(path?: string): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return `${this.fileBaseUrl}${cleanPath}`;
  }
}
