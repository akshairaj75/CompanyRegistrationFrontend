import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompanyResponse } from '../../../../core/models/company.model';
import {
  copyToClipboard,
  formatCompanyContactText,
  shareViaWhatsApp,
  shareViaEmail,
  downloadVCard,
  shareNative,
  canNativeShare
} from '../../../../core/utils/company-share.util';

@Component({
  selector: 'app-company-share-modal',
  standalone: true,
  imports: [CommonModule],
  styleUrl: './company-share-modal.component.css',
  template: `
    @if (company(); as comp) {
    <div class="modal-backdrop" (click)="onClose()">
      <div class="modal-card share-dialog-card" (click)="$event.stopPropagation()">

        <!-- Modal Header -->
        <div class="modal-header share-modal-header">
          <div class="modal-title-group">
            <span class="modal-pretitle"><i class="bi bi-share-fill"></i> Enterprise Contact Sharing</span>
            <h3 class="modal-title">{{ comp.companyName }}</h3>
          </div>
          <button type="button" class="modal-close-btn" (click)="onClose()" aria-label="Close share dialog">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <div class="modal-body share-modal-body">
          <!-- Summary Contact Card Preview -->
          <div class="share-preview-card">
            <div class="share-card-header">
              <div class="share-card-brand">
                <div class="share-card-avatar">
                  {{ comp.companyName.charAt(0).toUpperCase() }}
                </div>
                <div class="share-card-titles">
                  <h4 class="share-comp-title">{{ comp.companyName }}</h4>
                  <span class="share-comp-loc">
                    <i class="bi bi-geo-alt"></i> {{ comp.city ? comp.city + ', ' : '' }}{{ comp.country || 'Global' }}
                  </span>
                </div>
              </div>
              <span class="share-status-pill" [ngClass]="comp.status.toLowerCase()">{{ comp.status }}</span>
            </div>

            <div class="share-details-list">
              @if (comp.contactName) {
              <div class="share-detail-row">
                <span class="share-detail-label"><i class="bi bi-person-fill"></i> Contact</span>
                <span class="share-detail-val">
                  <strong>{{ comp.contactName }}</strong>
                  @if (comp.contactDesignation) {
                  <span class="desig-text"> &bull; {{ comp.contactDesignation }}</span>
                  }
                </span>
              </div>
              }

              @if (comp.contactMobileNumber) {
              <div class="share-detail-row">
                <span class="share-detail-label"><i class="bi bi-phone-fill"></i> Mobile</span>
                <a [href]="'tel:' + comp.contactMobileNumber" class="share-detail-link">
                  {{ comp.contactMobileNumber }}
                </a>
              </div>
              }

              @if (comp.landline) {
              <div class="share-detail-row">
                <span class="share-detail-label"><i class="bi bi-telephone-fill"></i> Landline</span>
                <a [href]="'tel:' + comp.landline" class="share-detail-link">
                  {{ comp.landline }}
                </a>
              </div>
              }

              @if (comp.email) {
              <div class="share-detail-row">
                <span class="share-detail-label"><i class="bi bi-envelope-fill"></i> Email</span>
                <a [href]="'mailto:' + comp.email" class="share-detail-link">
                  {{ comp.email }}
                </a>
              </div>
              }

              @if (comp.website) {
              <div class="share-detail-row">
                <span class="share-detail-label"><i class="bi bi-globe"></i> Website</span>
                <a [href]="comp.website" target="_blank" rel="noopener" class="share-detail-link text-truncate">
                  {{ comp.website }}
                </a>
              </div>
              }

              @if (comp.brands && comp.brands.length > 0) {
              <div class="share-detail-row">
                <span class="share-detail-label"><i class="bi bi-award-fill"></i> Brands</span>
                <span class="share-detail-val">
                  @for (b of comp.brands; track b.id; let last = $last) {
                  {{ b.brandName }}{{ !last ? ', ' : '' }}
                  }
                </span>
              </div>
              }
            </div>
          </div>

          <!-- Sharing Action Channels -->
          <div class="share-actions-section">
            <h5 class="share-section-title">Share Via</h5>

            <div class="share-buttons-grid">
              <!-- Copy To Clipboard -->
              <button type="button" class="share-channel-btn btn-copy" [class.copied]="isCopied()"
                (click)="copyDetails(comp)">
                <div class="share-icon-circle">
                  @if (isCopied()) {
                  <i class="bi bi-check2"></i>
                  } @else {
                  <i class="bi bi-clipboard2-check-fill"></i>
                  }
                </div>
                <div class="share-btn-text">
                  <span class="channel-title">
                    {{ isCopied() ? 'Copied to Clipboard!' : 'Copy Contact Details' }}
                  </span>
                  <span class="channel-sub">Formatted text summary</span>
                </div>
              </button>

              <!-- Share via WhatsApp -->
              <button type="button" class="share-channel-btn btn-whatsapp" (click)="onShareWhatsApp(comp)">
                <div class="share-icon-circle whatsapp-circle">
                  <i class="bi bi-whatsapp"></i>
                </div>
                <div class="share-btn-text">
                  <span class="channel-title">Share on WhatsApp</span>
                  <span class="channel-sub">Direct chat message</span>
                </div>
              </button>

              <!-- Share via Email -->
              <button type="button" class="share-channel-btn btn-email" (click)="onShareEmail(comp)">
                <div class="share-icon-circle email-circle">
                  <i class="bi bi-envelope-at-fill"></i>
                </div>
                <div class="share-btn-text">
                  <span class="channel-title">Send via Email</span>
                  <span class="channel-sub">Pre-filled email draft</span>
                </div>
              </button>

              <!-- Download vCard (.vcf) -->
              <button type="button" class="share-channel-btn btn-vcard" (click)="onDownloadVCard(comp)">
                <div class="share-icon-circle vcard-circle">
                  <i class="bi bi-person-vcard-fill"></i>
                </div>
                <div class="share-btn-text">
                  <span class="channel-title">Download vCard (.vcf)</span>
                  <span class="channel-sub">Import to phone contacts</span>
                </div>
              </button>

              <!-- Download PDF Profile (with Business Cards) -->
              <button type="button" class="share-channel-btn btn-pdf-profile" (click)="downloadPdf.emit(comp)"
                [disabled]="isExportingCompanyPdf() === comp.id">
                <div class="share-icon-circle pdf-profile-circle">
                  @if (isExportingCompanyPdf() === comp.id) {
                  <span class="spinner-border spinner-border-sm" role="status"></span>
                  } @else {
                  <i class="bi bi-file-earmark-pdf-fill"></i>
                  }
                </div>
                <div class="share-btn-text">
                  <span class="channel-title">Download PDF Profile</span>
                  <span class="channel-sub">With business cards images</span>
                </div>
              </button>

              <!-- Native System Share -->
              @if (hasNativeShare()) {
              <button type="button" class="share-channel-btn btn-native" (click)="onShareNative(comp)">
                <div class="share-icon-circle native-circle">
                  <i class="bi bi-share-fill"></i>
                </div>
                <div class="share-btn-text">
                  <span class="channel-title">Device Share Sheet</span>
                  <span class="channel-sub">AirDrop, Slack, Messages...</span>
                </div>
              </button>
              }
            </div>
          </div>
        </div>

        <div class="modal-footer share-modal-footer">
          <button type="button" class="btn-secondary" (click)="onClose()">Done</button>
        </div>
      </div>
    </div>
    }
  `
})
export class CompanyShareModalComponent {
  readonly company = input<CompanyResponse | null>(null);
  readonly isExportingCompanyPdf = input<number | null>(null);
  readonly close = output<void>();
  readonly downloadPdf = output<CompanyResponse>();

  readonly isCopied = signal<boolean>(false);
  readonly hasNativeShare = signal<boolean>(canNativeShare());

  onClose(): void {
    this.close.emit();
  }

  async copyDetails(comp: CompanyResponse): Promise<void> {
    const text = formatCompanyContactText(comp);
    const success = await copyToClipboard(text);
    if (success) {
      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2500);
    }
  }

  onShareWhatsApp(comp: CompanyResponse): void {
    shareViaWhatsApp(comp);
  }

  onShareEmail(comp: CompanyResponse): void {
    shareViaEmail(comp);
  }

  onDownloadVCard(comp: CompanyResponse): void {
    downloadVCard(comp);
  }

  async onShareNative(comp: CompanyResponse): Promise<void> {
    await shareNative(comp);
  }
}
