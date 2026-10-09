import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { BusinessCardScanResult, GoogleVisionAnnotateRequest, GoogleVisionResponse } from '../models/ocr.model';
import { BusinessCardParserService } from './business-card-parser.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OcrService {
  private readonly httpBackend = inject(HttpBackend);
  // Isolated HttpClient that bypasses app-level interceptors (preventing backend JWT from being sent to Google)
  private readonly http = new HttpClient(this.httpBackend);
  private readonly parser = inject(BusinessCardParserService);

  getApiKey(): string {
    return environment.googleVisionApiKey || '';
  }

  hasConfiguredKey(): boolean {
    return !!this.getApiKey();
  }

  scanBusinessCard(file: File): Observable<BusinessCardScanResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return throwError(() => new Error('Business card scanning service is currently not configured.'));
    }

    return this.fileToBase64(file).pipe(
      switchMap(base64Data => {
        return this.callGoogleVisionApi(base64Data, apiKey).pipe(
          catchError(err => {
            const errMsg = err?.message || '';
            if (errMsg.includes('No readable text') || errMsg.includes('no readable text')) {
              return throwError(() => new Error('No readable text detected on this image. Please upload a clear, focused photo of a business card.'));
            }
            console.error('OCR service error:', err);
            return throwError(() => new Error('Unable to scan business card at this moment. Please enter details manually.'));
          })
        );
      })
    );
  }

  private callGoogleVisionApi(base64Data: string, apiKey: string): Observable<BusinessCardScanResult> {
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`;
    const payload: GoogleVisionAnnotateRequest = {
      requests: [
        {
          image: {
            content: base64Data
          },
          features: [
            {
              type: 'DOCUMENT_TEXT_DETECTION',
              maxResults: 1
            }
          ]
        }
      ]
    };

    return this.http.post<GoogleVisionResponse>(url, payload).pipe(
      map(res => {
        const responseItem = res?.responses?.[0];
        if (responseItem?.error) {
          throw new Error(responseItem.error.message || 'Vision API returned an error');
        }

        const rawText = responseItem?.fullTextAnnotation?.text
          || responseItem?.textAnnotations?.[0]?.description
          || '';

        if (!rawText.trim()) {
          throw new Error('No readable text found on the business card image.');
        }

        return this.parser.parse(rawText);
      })
    );
  }

  private fileToBase64(file: File): Observable<string> {
    return from(
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip prefix data:...;base64,
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      })
    );
  }
}
