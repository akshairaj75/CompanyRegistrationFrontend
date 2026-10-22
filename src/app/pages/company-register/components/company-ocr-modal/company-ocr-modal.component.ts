import { Component, inject, signal, computed, input, output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OcrService } from '../../../../core/services/ocr.service';
import { BusinessCardScanResult } from '../../../../core/models/ocr.model';
import { COUNTRY_OPTIONS, normalizeToCountryCode } from '../../../../core/models/country.model';

@Component({
  selector: 'app-company-ocr-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrl: './company-ocr-modal.component.css',
  template: `
    @if (isOpen()) {
    <div class="modal-backdrop ocr-modal-backdrop" (click)="onClose()">
      <div class="modal-dialog ocr-modal-dialog" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
        <div class="modal-content ocr-modal-content">
          <!-- Modal Header -->
          <div class="modal-header ocr-modal-header">
            <div class="ocr-header-left">
              <div class="ocr-header-icon" [class.scanning]="isScanningCard()">
                <i class="bi" [class.bi-cpu-fill]="isScanningCard()" [class.bi-card-heading]="!isScanningCard()"></i>
              </div>
              <div>
                <h3 class="modal-title">
                  {{ isScanningCard() ? 'Scanning Visiting Card...' : 'Review Visiting Card Details' }}
                </h3>
                <p class="modal-subtitle">
                  {{ isScanningCard() ? 'Reading company and contact details from card...' : 'Confirm or refine the recognized details below before applying to your form' }}
                </p>
              </div>
            </div>
            <div class="ocr-header-right">
              @if (scannedCardResult(); as result) {
              <div class="ocr-score-badge" [class.high]="result.confidenceScore >= 70"
                [class.medium]="result.confidenceScore >= 40 && result.confidenceScore < 70"
                [class.low]="result.confidenceScore < 40">
                <i class="bi bi-shield-check"></i>
                <span>{{ result.confidenceScore }}% Confidence</span>
              </div>
              }
              <button type="button" class="btn-modal-close" (click)="onClose()" [disabled]="isScanningCard()"
                aria-label="Close modal">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
          </div>

          <!-- Modal Body -->
          <div class="modal-body ocr-modal-body">
            <div class="ocr-layout-grid">
              <!-- Left Pane: Card Image Preview & Laser Scan Animation -->
              <div class="ocr-card-preview-pane">
                <div class="ocr-preview-card-wrap" [class.is-scanning]="isScanningCard()">
                  @if (scannedCardPreview()) {
                  <img [src]="scannedCardPreview()" alt="Scanned Business Card" class="ocr-card-img" />
                  @if (scannedCardFile() && ocrService.isPdfFile(scannedCardFile()!)) {
                  <span class="ocr-pdf-badge"><i class="bi bi-file-earmark-pdf-fill"></i> PDF Page 1</span>
                  }
                  @if (isScanningCard()) {
                  <div class="ocr-laser-scan-line"></div>
                  <div class="ocr-scan-overlay">
                    <div class="ocr-scan-pulse-ring"></div>
                    <span class="ocr-scan-pulse-text">Recognizing Text...</span>
                  </div>
                  }
                  } @else {
                  <div class="ocr-preview-empty" (click)="ocrModalFileInput.click()">
                    <i class="bi bi-camera"></i>
                    <span>Click to choose business card (Image or PDF)</span>
                  </div>
                  }
                </div>

                <!-- Retake / Select Another Button -->
                <div class="ocr-preview-actions">
                  <input #ocrModalFileInput type="file" class="hidden-file-input" (change)="onFileSelected($event)"
                    accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" />
                  <button type="button" class="btn-retake-card" (click)="ocrModalFileInput.click()"
                    [disabled]="isScanningCard()">
                    <i class="bi bi-arrow-repeat"></i> {{ scannedCardPreview() ? 'Change Card / PDF' : 'Select Card / PDF' }}
                  </button>
                  @if (scannedCardFile()) {
                  <span class="ocr-file-name-tag">{{ scannedCardFile()?.name }}</span>
                  }
                </div>
              </div>

              <!-- Right Pane: Extracted Entities Review & Edit -->
              <div class="ocr-extracted-fields-pane">
                @if (isScanningCard()) {
                <div class="ocr-scanning-skeleton">
                  <div class="ocr-skeleton-header">
                    <div class="skeleton-shimmer skeleton-title-bar"></div>
                    <div class="skeleton-shimmer skeleton-sub-bar"></div>
                  </div>
                  <div class="ocr-skeleton-grid">
                    <div class="skeleton-shimmer skeleton-input-box"></div>
                    <div class="skeleton-shimmer skeleton-input-box"></div>
                    <div class="skeleton-shimmer skeleton-input-box"></div>
                    <div class="skeleton-shimmer skeleton-input-box"></div>
                    <div class="skeleton-shimmer skeleton-input-box"></div>
                    <div class="skeleton-shimmer skeleton-input-box"></div>
                  </div>
                  <div class="ocr-scanning-notice">
                    <div class="spinner-border spinner-border-sm text-primary"></div>
                    <span>Extracting company, contacts, phone numbers, and address...</span>
                  </div>
                </div>
                } @else if (scannedCardResult(); as result) {
                <div class="ocr-fields-form">
                  @if (result.confidenceScore < 35) {
                  <div class="ocr-unrecognized-banner">
                    <div class="ocr-unrecognized-icon">
                      <i class="bi bi-exclamation-triangle-fill"></i>
                    </div>
                    <div class="ocr-unrecognized-text">
                      <span class="unrecognized-title">Low Confidence / Unrecognized Card</span>
                      <p class="unrecognized-desc">
                        Could not detect standard business card contact entities (contact person, phone, or email). You can fill in fields manually or try uploading a clearer, higher-contrast image.
                      </p>
                    </div>
                  </div>
                  }

                  <div class="ocr-fields-intro">
                    <i class="bi bi-info-circle"></i>
                    <span>Fields detected by OCR. You can refine any value below before applying:</span>
                  </div>

                  <div class="ocr-fields-grid">
                    <!-- Company Name -->
                    <div class="ocr-field-item span-2">
                      <label class="ocr-field-label">
                        <i class="bi bi-building"></i> Company Name
                      </label>
                      <input type="text" class="ocr-input" [(ngModel)]="result.companyName"
                        placeholder="e.g. Apex Global Corp" />
                    </div>

                    <!-- Contact Person Name -->
                    <div class="ocr-field-item">
                      <label class="ocr-field-label">
                        <i class="bi bi-person"></i> Contact Name
                      </label>
                      <input type="text" class="ocr-input" [(ngModel)]="result.contactName"
                        placeholder="e.g. Elena Rostova" />
                    </div>

                    <!-- Contact Designation -->
                    <div class="ocr-field-item">
                      <label class="ocr-field-label">
                        <i class="bi bi-briefcase"></i> Designation / Title
                      </label>
                      <input type="text" class="ocr-input" [(ngModel)]="result.contactDesignation"
                        placeholder="e.g. Managing Director" />
                    </div>

                    <!-- Mobile Number -->
                    <div class="ocr-field-item">
                      <label class="ocr-field-label">
                        <i class="bi bi-phone"></i> Mobile Number
                      </label>
                      <input type="tel" class="ocr-input" [(ngModel)]="result.contactMobileNumber"
                        placeholder="e.g. +1 917 433-2890" (keydown)="allowOnlyPhoneChars($event)"
                        (input)="sanitizePhoneInput($event, 'contactMobileNumber')" />
                    </div>

                    <!-- Landline / Office -->
                    <div class="ocr-field-item">
                      <label class="ocr-field-label">
                        <i class="bi bi-telephone"></i> Landline / Office
                      </label>
                      <input type="tel" class="ocr-input" [(ngModel)]="result.landline"
                        placeholder="e.g. +1 212 650-8910" (keydown)="allowOnlyPhoneChars($event)"
                        (input)="sanitizePhoneInput($event, 'landline')" />
                    </div>

                    <!-- Email Address -->
                    <div class="ocr-field-item">
                      <label class="ocr-field-label">
                        <i class="bi bi-envelope"></i> Email Address
                      </label>
                      <input type="email" class="ocr-input" [(ngModel)]="result.email"
                        placeholder="e.g. info@apexgroup.com" />
                    </div>

                    <!-- Direct Contact Email -->
                    <div class="ocr-field-item">
                      <label class="ocr-field-label">
                        <i class="bi bi-envelope-at"></i> Direct Contact Email
                      </label>
                      <input type="email" class="ocr-input" [(ngModel)]="result.contactEmail"
                        placeholder="e.g. elena@apexgroup.com" />
                    </div>

                    <!-- Website -->
                    <div class="ocr-field-item span-2">
                      <label class="ocr-field-label">
                        <i class="bi bi-globe"></i> Website URL
                      </label>
                      <input type="text" class="ocr-input" [(ngModel)]="result.website"
                        placeholder="e.g. https://www.apexgroup.com" />
                    </div>

                    <!-- Address -->
                    <div class="ocr-field-item span-2">
                      <label class="ocr-field-label">
                        <i class="bi bi-geo-alt"></i> Address
                      </label>
                      <input type="text" class="ocr-input" [(ngModel)]="result.address"
                        placeholder="e.g. 1250 Avenue of the Americas, 18th Floor" />
                    </div>

                    <!-- City -->
                    <div class="ocr-field-item">
                      <label class="ocr-field-label">
                        <i class="bi bi-pin-map"></i> City
                      </label>
                      <input type="text" class="ocr-input" [(ngModel)]="result.city" placeholder="e.g. New York" />
                    </div>

                    <!-- Country Searchable in OCR Modal -->
                    <div class="ocr-field-item ocr-country-dropdown-container" [class.is-open]="isOcrCountryDropdownOpen()">
                      <label class="ocr-field-label">
                        <i class="bi bi-flag"></i> Country
                      </label>
                      <button type="button" class="ocr-input country-select-trigger" (click)="toggleOcrCountryDropdown()">
                        <div class="country-trigger-content">
                          @if (selectedOcrCountryOption(); as opt) {
                          <span class="country-code-pill">{{ opt.code }}</span>
                          <span class="country-name-text">{{ opt.name }}</span>
                          } @else {
                          <span class="country-placeholder">Select Country</span>
                          }
                        </div>
                        <i class="bi bi-chevron-down country-chevron" [class.rotate]="isOcrCountryDropdownOpen()"></i>
                      </button>

                      @if (isOcrCountryDropdownOpen()) {
                      <div class="country-dropdown-menu ocr-country-menu animate-fade-in"
                        (click)="$event.stopPropagation()">
                        <div class="country-search-bar">
                          <i class="bi bi-search country-search-icon"></i>
                          <input type="text" id="ocr-country-search-input" class="country-search-input"
                            placeholder="Search country..." [value]="ocrCountrySearchQuery()"
                            (input)="ocrCountrySearchQuery.set($any($event.target).value)" />
                        </div>
                        <div class="country-options-list custom-scrollbar">
                          @for (c of filteredOcrCountryOptions(); track c.code) {
                          <div class="country-option-item" [class.is-selected]="result.country === c.code"
                            (click)="selectOcrCountry(c.code)">
                            <span class="country-code-pill">{{ c.code }}</span>
                            <span class="country-full-name">{{ c.name }}</span>
                            @if (result.country === c.code) {
                            <i class="bi bi-check2 country-check-icon"></i>
                            }
                          </div>
                          }
                        </div>
                      </div>
                      }
                    </div>
                  </div>

                  <!-- Auto Attach Option -->
                  <label class="ocr-attach-checkbox-label">
                    <input type="checkbox" [checked]="autoAttachScannedCard()"
                      (change)="autoAttachScannedCard.set(!autoAttachScannedCard())" />
                    <span>Attach this card image to Section 07 (Visiting Cards) on form apply</span>
                  </label>
                </div>
                }
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="modal-footer ocr-modal-footer">
            <button type="button" class="btn-secondary" (click)="onClose()" [disabled]="isScanningCard()">
              Cancel
            </button>
            <button type="button" class="btn-primary btn-apply-ocr" (click)="onApply()"
              [disabled]="isScanningCard() || !scannedCardResult() || !hasOcrExtractedFields()"
              [title]="hasOcrExtractedFields() ? 'Apply extracted details to form' : 'Enter or detect at least one detail to apply'">
              <i class="bi bi-check2-circle"></i> Apply Details to Form
            </button>
          </div>
        </div>
      </div>
    </div>
    }
  `
})
export class CompanyOcrModalComponent implements OnChanges {
  readonly ocrService = inject(OcrService);
  readonly countryOptions = COUNTRY_OPTIONS;

  readonly isOpen = input<boolean>(false);
  readonly initialFile = input<File | null>(null);

  readonly closeModal = output<void>();
  readonly close = this.closeModal;
  readonly applyResult = output<{ result: BusinessCardScanResult; file: File | null; autoAttach: boolean }>();
  readonly scanError = output<string>();

  readonly isScanningCard = signal<boolean>(false);
  readonly scannedCardResult = signal<BusinessCardScanResult | null>(null);
  readonly scannedCardPreview = signal<string | null>(null);
  readonly scannedCardFile = signal<File | null>(null);
  readonly autoAttachScannedCard = signal<boolean>(true);

  // Country Search Dropdown State
  readonly ocrCountrySearchQuery = signal<string>('');
  readonly isOcrCountryDropdownOpen = signal<boolean>(false);
  readonly ocrSelectedCountry = signal<string>('');

  readonly filteredOcrCountryOptions = computed(() => {
    const q = this.ocrCountrySearchQuery().toLowerCase().trim();
    if (!q) return this.countryOptions;
    return this.countryOptions.filter(c =>
      c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  });

  readonly selectedOcrCountryOption = computed(() => {
    const code = this.ocrSelectedCountry() || this.scannedCardResult()?.country;
    if (!code) return null;
    return this.countryOptions.find(c => c.code.toUpperCase() === code.toUpperCase()) || { code, name: code };
  });

  readonly hasOcrExtractedFields = computed(() => {
    const res = this.scannedCardResult();
    if (!res) return false;
    return !!(
      res.companyName?.trim() ||
      res.contactName?.trim() ||
      res.contactDesignation?.trim() ||
      res.email?.trim() ||
      res.contactEmail?.trim() ||
      res.contactMobileNumber?.trim() ||
      res.landline?.trim() ||
      res.website?.trim() ||
      res.address?.trim() ||
      res.city?.trim() ||
      res.country?.trim()
    );
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialFile'] && this.initialFile()) {
      this.processFile(this.initialFile()!);
    } else if (changes['isOpen'] && this.isOpen() && this.initialFile() && this.scannedCardFile() !== this.initialFile()) {
      this.processFile(this.initialFile()!);
    }
  }

  onClose(): void {
    if (this.isScanningCard()) return;
    this.closeModal.emit();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
      input.value = '';
    }
  }

  processFile(file: File): void {
    const isPdf = this.ocrService.isPdfFile(file);
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type) && !isPdf) {
      this.scanError.emit('Please upload a JPG, PNG, WEBP, or PDF file of the business card for OCR processing.');
      return;
    }

    this.scannedCardFile.set(file);
    this.isScanningCard.set(true);

    if (isPdf) {
      this.ocrService.renderPdfPageToImage(file, 1)
        .then(res => this.scannedCardPreview.set(res.imageUrl))
        .catch(err => console.warn('PDF preview render warning:', err));
    } else {
      const reader = new FileReader();
      reader.onload = (e) => this.scannedCardPreview.set(e.target?.result as string);
      reader.readAsDataURL(file);
    }

    this.ocrService.scanBusinessCard(file).subscribe({
      next: (result) => {
        if (result && result.country) {
          result.country = normalizeToCountryCode(result.country);
          this.ocrSelectedCountry.set(result.country);
        } else {
          this.ocrSelectedCountry.set('');
        }
        this.scannedCardResult.set(result);
        this.isScanningCard.set(false);
      },
      error: (err) => {
        console.error('OCR scanning error:', err);
        this.isScanningCard.set(false);
        this.scanError.emit(err?.message || 'Could not extract text from the file.');
      }
    });
  }

  toggleOcrCountryDropdown(): void {
    this.isOcrCountryDropdownOpen.update(v => !v);
    if (this.isOcrCountryDropdownOpen()) {
      this.ocrCountrySearchQuery.set('');
      setTimeout(() => {
        const input = document.getElementById('ocr-country-search-input') as HTMLInputElement;
        if (input) input.focus();
      }, 50);
    }
  }

  selectOcrCountry(code: string): void {
    this.ocrSelectedCountry.set(code);
    const res = this.scannedCardResult();
    if (res) {
      res.country = code;
      this.scannedCardResult.set({ ...res });
    }
    this.isOcrCountryDropdownOpen.set(false);
    this.ocrCountrySearchQuery.set('');
  }

  allowOnlyPhoneChars(event: KeyboardEvent): void {
    if (
      event.key === 'Backspace' ||
      event.key === 'Delete' ||
      event.key === 'Tab' ||
      event.key === 'Escape' ||
      event.key === 'Enter' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      event.key === 'Home' ||
      event.key === 'End' ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    if (!/^[0-9+\-\s().]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  sanitizePhoneInput(event: Event, field: 'contactMobileNumber' | 'landline'): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/[^0-9+\-\s().]/g, '');
    if (input.value !== sanitized) {
      input.value = sanitized;
    }
    const res = this.scannedCardResult();
    if (res) {
      res[field] = sanitized;
    }
  }

  onApply(): void {
    const res = this.scannedCardResult();
    if (!res) return;
    this.applyResult.emit({
      result: res,
      file: this.scannedCardFile(),
      autoAttach: this.autoAttachScannedCard()
    });
  }
}
