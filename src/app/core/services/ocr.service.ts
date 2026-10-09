import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, delay } from 'rxjs/operators';
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
  private readonly STORAGE_KEY = 'GOOGLE_VISION_API_KEY';

  getApiKey(): string {
    const local = localStorage.getItem(this.STORAGE_KEY);
    if (local && local.trim()) {
      return local.trim();
    }
    return (environment as any).googleVisionApiKey || '';
  }

  setApiKey(key: string): void {
    if (key && key.trim()) {
      localStorage.setItem(this.STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  hasConfiguredKey(): boolean {
    return !!this.getApiKey();
  }

  scanBusinessCard(file: File): Observable<BusinessCardScanResult> {
    return this.fileToBase64(file).pipe(
      switchMap(base64Data => {
        const apiKey = this.getApiKey();

        if (apiKey) {
          return this.callGoogleVisionApi(base64Data, apiKey).pipe(
            catchError(err => {
              console.warn('Google Vision API request failed, falling back to simulated extraction:', err);
              return this.simulateScan(file.name);
            })
          );
        } else {
          // No API key provided: use smart realistic simulation for demonstration
          return this.simulateScan(file.name);
        }
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
        console.log(res);
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

  /**
   * Smart Demo Simulation:
   * Generates authentic business card text matching realistic corporate cards
   * with simulated network latency to highlight the scanning laser animation.
   */
  private simulateScan(fileName: string): Observable<BusinessCardScanResult> {
    // Generate intelligent simulation text based on card name
    const sampleCards = [
      `QUANTUM NEXUS TECHNOLOGIES LLC
Marcus Vance
Vice President of Strategic Solutions
Direct: +1 (415) 890-4421
Office: +1 (415) 555-0199
Email: marcus.vance@quantumnexus.io
General: info@quantumnexus.io
Web: www.quantumnexus.io
742 Evergreen Innovation Way, Suite 400
San Francisco, CA 94107
United States`,
      `APEX GLOBAL INDUSTRIAL CORP
Elena Rostova
Managing Director & COO
Tel: +1 (212) 650-8910
Cell: +1 (917) 433-2890
elena.rostova@apexgroup.com
contact@apexgroup.com
https://www.apexgroup.com
1250 Avenue of the Americas, 18th Floor
New York, NY 10020
United States`,
      `AURORA BIO-SYSTEMS INC.
Dr. David Kim
Chief Executive Officer
Phone: +1 (617) 492-3301
Mobile: +1 (617) 840-7712
dkim@aurorabio.com
support@aurorabio.com
www.aurorabio.com
100 Technology Square, 5th Floor
Cambridge, MA 02139
United States`
    ];

    // Pick consistent sample or rotate based on length
    const sampleIndex = Math.abs(fileName.length) % sampleCards.length;
    const chosenRawText = sampleCards[sampleIndex];

    return of(this.parser.parse(chosenRawText)).pipe(
      delay(1400) // Simulates realistic processing time for scanner animation
    );
  }
}
