import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CompanyRequest, CompanyResponse } from '../models/company.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CompanyService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/companies`;
  private readonly fileBaseUrl = environment.fileUrl;

  /**
   * Fetch all companies from backend
   */
  getAllCompanies(): Observable<CompanyResponse[]> {
    return this.http.get<CompanyResponse[]>(`${this.apiUrl}/get-all`);
  }

  /**
   * Get single company by ID
   */
  getCompanyById(id: number): Observable<CompanyResponse> {
    return this.http.get<CompanyResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Register a new company with multipart data (JSON dto + optional logo/business card file)
   */
  createCompany(companyData: CompanyRequest, file?: File | null): Observable<CompanyResponse> {
    const formData = new FormData();
    const dataBlob = new Blob([JSON.stringify(companyData)], { type: 'application/json' });
    formData.append('data', dataBlob);

    if (file) {
      formData.append('file', file, file.name);
    }

    return this.http.post<CompanyResponse>(`${this.apiUrl}/create`, formData);
  }

  /**
   * Update an existing company
   */
  updateCompany(id: number, companyData: CompanyRequest, file?: File | null): Observable<CompanyResponse> {
    const formData = new FormData();
    const dataBlob = new Blob([JSON.stringify(companyData)], { type: 'application/json' });
    formData.append('data', dataBlob);

    if (file) {
      formData.append('file', file, file.name);
    }

    return this.http.put<CompanyResponse>(`${this.apiUrl}/update/${id}`, formData);
  }

  /**
   * Delete a company by ID
   */
  deleteCompany(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/delete/${id}`);
  }

  /**
   * Export all companies as an Excel workbook
   */
  exportCompaniesToExcel(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/excel`, {
      responseType: 'blob'
    });
  }

  /**
   * Formats the business card / file URL if stored path is relative
   */
  getFileUrl(path?: string): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return `${this.fileBaseUrl}${cleanPath}`;
  }
}
