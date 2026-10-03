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
   * Register a new company with multipart data (JSON dto + optional multiple logo/business card files)
   */
  createCompany(companyData: CompanyRequest, files?: File[] | File | null): Observable<CompanyResponse> {
    const formData = new FormData();
    const dataBlob = new Blob([JSON.stringify(companyData)], { type: 'application/json' });
    formData.append('data', dataBlob);

    if (files) {
      if (Array.isArray(files)) {
        files.forEach(file => formData.append('files', file, file.name));
      } else {
        formData.append('files', files, files.name);
      }
    }

    return this.http.post<CompanyResponse>(`${this.apiUrl}/create`, formData);
  }

  /**
   * Update an existing company with optional new files
   */
  updateCompany(id: number, companyData: CompanyRequest, files?: File[] | File | null): Observable<CompanyResponse> {
    const formData = new FormData();
    const dataBlob = new Blob([JSON.stringify(companyData)], { type: 'application/json' });
    formData.append('data', dataBlob);

    if (files) {
      if (Array.isArray(files)) {
        files.forEach(file => formData.append('files', file, file.name));
      } else {
        formData.append('files', files, files.name);
      }
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
   * Export all companies as a PDF document
   */
  exportCompaniesToPdf(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/pdf`, {
      responseType: 'blob'
    });
  }

  /**
   * Export single company profile as a PDF document (includes contact details & business card images)
   */
  exportCompanyProfilePdf(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/export/pdf`, {
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
