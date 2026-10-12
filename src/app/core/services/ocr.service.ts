import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { BusinessCardScanResult, GoogleVisionAnnotateRequest, GoogleVisionResponse } from '../models/ocr.model';
import { BusinessCardParserService } from './business-card-parser.service';
import { environment } from '../../../environments/environment';

export interface PdfRenderResult {
  imageUrl: string;
  imageFile: File;
  extractedText: string;
}

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

  isPdfFile(file: File | string): boolean {
    if (typeof file === 'string') {
      return file.toLowerCase().endsWith('.pdf');
    }
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  }

  /**
   * Dynamically loads PDF.js from official CDN if not already loaded.
   */
  loadPdfJs(): Promise<any> {
    if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
      return Promise.resolve((window as any).pdfjsLib);
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        const pdfjs = (window as any).pdfjsLib;
        if (pdfjs) {
          pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(pdfjs);
        } else {
          reject(new Error('PDF.js library failed to initialize.'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load PDF library. Please check your internet connection.'));
      document.head.appendChild(script);
    });
  }

  /**
   * Renders Page 1 of a PDF onto an HTML5 canvas at high DPI (scale 2.0),
   * extracts any digital text items, and exports a JPEG File and data URL.
   */
  async renderPdfPageToImage(file: File, pageNumber: number = 1): Promise<PdfRenderResult> {
    const pdfjs = await this.loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(pageNumber);

    // 1. Extract digital text directly
    let extractedText = '';
    try {
      const textContent = await page.getTextContent();
      extractedText = textContent.items
        .map((item: any) => item.str || '')
        .filter((str: string) => str.trim().length > 0)
        .join('\n')
        .trim();
    } catch (e) {
      console.warn('PDF text content extraction warning:', e);
    }

    // 2. Render Page 1 to high-resolution canvas for sharp visual display & OCR
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is not supported in this browser.');
    }

    // Set white background before rasterizing
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const imageUrl = canvas.toDataURL('image/jpeg', 0.95);

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(b => resolve(b), 'image/jpeg', 0.95)
    );

    if (!blob) {
      throw new Error('Failed to convert PDF page canvas to image blob.');
    }

    const cleanBase = file.name.replace(/\.pdf$/i, '');
    const imageFile = new File([blob], `${cleanBase}-page${pageNumber}.jpg`, {
      type: 'image/jpeg'
    });

    return {
      imageUrl,
      imageFile,
      extractedText
    };
  }

  scanBusinessCard(file: File): Observable<BusinessCardScanResult> {
    // Branch 1: Handle PDF Files (Digital extraction with fallback to rendered image OCR)
    if (this.isPdfFile(file)) {
      return from(this.renderPdfPageToImage(file, 1)).pipe(
        switchMap(renderRes => {
          // If rich digital text exists in the PDF, parse it directly
          if (renderRes.extractedText && renderRes.extractedText.length > 25) {
            const parsed = this.parser.parse(renderRes.extractedText);
            if (parsed.confidenceScore >= 35 || parsed.email || parsed.contactMobileNumber || parsed.companyName) {
              return of(parsed);
            }
          }

          // Otherwise (scanned image in PDF or sparse text), send rendered image to Google Vision
          const apiKey = this.getApiKey();
          if (!apiKey) {
            if (renderRes.extractedText) {
              return of(this.parser.parse(renderRes.extractedText));
            }
            return throwError(() => new Error('Business card scanning service is currently not configured.'));
          }

          return this.fileToBase64(renderRes.imageFile).pipe(
            switchMap(base64Data => this.callGoogleVisionApi(base64Data, apiKey))
          );
        }),
        catchError(err => {
          console.error('PDF OCR processing error:', err);
          return throwError(() => new Error(err?.message || 'Unable to scan PDF document. Please verify the file is not corrupted.'));
        })
      );
    }

    // Branch 2: Standard Image Files (JPG, PNG, WEBP)
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
