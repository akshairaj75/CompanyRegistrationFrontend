import { Component, inject, signal, computed, input, output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompanyResponse } from '../../../../core/models/company.model';
import { BrandResponse } from '../../../../core/models/brand.model';
import { ProductResponse } from '../../../../core/models/product.model';
import { CompanyService } from '../../../../core/services/company';
import { BrandService } from '../../../../core/services/brand';
import { ProductService } from '../../../../core/services/product';
import { AuthService } from '../../../../core/services/auth.service';
import { getHumanReadableHttpError } from '../../../../core/utils/company-form.util';

@Component({
  selector: 'app-company-directory',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './company-directory.component.html',
  styleUrl: './company-directory.component.css'
})
export class CompanyDirectoryComponent {
  readonly companyService = inject(CompanyService);
  readonly brandService = inject(BrandService);
  readonly productService = inject(ProductService);
  readonly authService = inject(AuthService);

  // Inputs
  readonly companies = input.required<CompanyResponse[]>();
  readonly isLoadingList = input<boolean>(false);
  readonly initialSelectedCompany = input<CompanyResponse | null>(null);

  // Outputs / Events
  readonly editCompany = output<CompanyResponse>();
  readonly refreshCompanies = output<void>();
  readonly openShare = output<CompanyResponse>();
  readonly newRegistration = output<void>();
  readonly feedbackMessage = output<{ type: 'success' | 'error'; title: string; message: string }>();

  // Search State
  readonly searchQuery = signal<string>('');
  readonly isSearchFocused = signal<boolean>(false);
  readonly activeAutofillIndex = signal<number>(-1);

  // View Details Modal State
  readonly selectedCompany = signal<CompanyResponse | null>(null);

  constructor() {
    effect(() => {
      const init = this.initialSelectedCompany();
      if (init) {
        this.selectedCompany.set(init);
      }
    });
  }

  // Delete Confirmation Modal State
  readonly companyToDelete = signal<CompanyResponse | null>(null);
  readonly isDeleting = signal<boolean>(false);

  // Export State
  readonly isExportingExcel = signal<boolean>(false);
  readonly isExportingPdf = signal<boolean>(false);
  readonly isExportingCompanyPdf = signal<number | null>(null);

  // Filtered companies based on search
  readonly filteredCompanies = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const list = this.companies();
    if (!query) return list;
    return list.filter(c =>
      c.companyName?.toLowerCase().includes(query) ||
      c.contactName?.toLowerCase().includes(query) ||
      c.contactEmail?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.city?.toLowerCase().includes(query) ||
      c.country?.toLowerCase().includes(query) ||
      c.brands?.some(b => b.brandName?.toLowerCase().includes(query)) ||
      c.products?.some(p => p.name?.toLowerCase().includes(query))
    );
  });

  // Searchbar Suggestions (Directory Search)
  readonly searchSuggestions = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.companies();
    if (!q) {
      return list.slice(0, 5);
    }
    return list.filter(c =>
      c.companyName?.toLowerCase().includes(q) ||
      c.contactName?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.contactEmail?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.country?.toLowerCase().includes(q) ||
      c.brands?.some(b => b.brandName?.toLowerCase().includes(q)) ||
      c.products?.some(p => p.name?.toLowerCase().includes(q))
    ).slice(0, 7);
  });

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
    this.isSearchFocused.set(true);
    this.activeAutofillIndex.set(-1);
  }

  onSearchFocus(): void {
    this.isSearchFocused.set(true);
    this.activeAutofillIndex.set(-1);
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.isSearchFocused.set(false);
      this.activeAutofillIndex.set(-1);
    }, 220);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.activeAutofillIndex.set(-1);
  }

  selectSuggestion(company: CompanyResponse): void {
    this.searchQuery.set(company.companyName);
    this.isSearchFocused.set(false);
    this.activeAutofillIndex.set(-1);
  }

  selectSuggestionAndOpen(company: CompanyResponse, event?: Event): void {
    if (event) event.stopPropagation();
    this.searchQuery.set(company.companyName);
    this.isSearchFocused.set(false);
    this.activeAutofillIndex.set(-1);
    this.openCompanyDetail(company);
  }

  onSearchKeyDown(event: KeyboardEvent): void {
    const suggestions = this.searchSuggestions();
    if (!this.isSearchFocused() || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const current = this.activeAutofillIndex();
      const next = current + 1 >= suggestions.length ? 0 : current + 1;
      this.activeAutofillIndex.set(next);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const current = this.activeAutofillIndex();
      const prev = current <= 0 ? suggestions.length - 1 : current - 1;
      this.activeAutofillIndex.set(prev);
    } else if (event.key === 'Enter') {
      const idx = this.activeAutofillIndex();
      if (idx >= 0 && idx < suggestions.length) {
        event.preventDefault();
        this.selectSuggestion(suggestions[idx]);
      }
    } else if (event.key === 'Escape') {
      this.isSearchFocused.set(false);
      this.activeAutofillIndex.set(-1);
    }
  }

  getHighlightSegments(text: string | null | undefined, query: string): { text: string; isMatch: boolean }[] {
    if (!text) return [];
    if (!query || !query.trim()) return [{ text, isMatch: false }];
    const q = query.trim().toLowerCase();
    const lower = text.toLowerCase();
    const index = lower.indexOf(q);
    if (index === -1) return [{ text, isMatch: false }];
    return [
      { text: text.substring(0, index), isMatch: false },
      { text: text.substring(index, index + q.length), isMatch: true },
      { text: text.substring(index + q.length), isMatch: false }
    ];
  }

  getCompanyCards(company: CompanyResponse): string[] {
    if (company.businessCards && company.businessCards.length > 0) {
      return company.businessCards;
    }
    return company.businessCard ? [company.businessCard] : [];
  }

  // --- Permissions ---
  canEditCompany(company?: CompanyResponse | null): boolean {
    if (!company) return false;
    if (this.authService.isSuperAdmin()) {
      return true;
    }
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      return false;
    }
    if (company.userId && currentUser.id) {
      return Number(company.userId) === Number(currentUser.id);
    }
    if (company.email && currentUser.email) {
      return company.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
    }
    return false;
  }

  canDeleteCompany(): boolean {
    return this.authService.isSuperAdmin();
  }

  // --- View Detail Modal ---
  openCompanyDetail(comp: CompanyResponse): void {
    this.selectedCompany.set(comp);
  }

  closeCompanyDetail(): void {
    this.selectedCompany.set(null);
  }

  // --- Delete Actions ---
  promptDelete(company: CompanyResponse, event?: Event): void {
    if (event) event.stopPropagation();
    if (!this.canDeleteCompany()) {
      this.feedbackMessage.emit({
        type: 'error',
        title: 'Access Restricted',
        message: 'Only SUPER_ADMIN is authorized to delete company records.'
      });
      return;
    }
    this.companyToDelete.set(company);
  }

  cancelDelete(): void {
    this.companyToDelete.set(null);
  }

  confirmDelete(): void {
    const toDelete = this.companyToDelete();
    if (!toDelete) return;

    this.isDeleting.set(true);
    this.companyService.deleteCompany(toDelete.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.feedbackMessage.emit({
          type: 'success',
          title: 'Company Deleted',
          message: `"${toDelete.companyName}" has been successfully deleted.`
        });
        if (this.selectedCompany()?.id === toDelete.id) {
          this.closeCompanyDetail();
        }
        this.companyToDelete.set(null);
        this.refreshCompanies.emit();
      },
      error: (err) => {
        this.isDeleting.set(false);
        console.error('Delete failed:', err);
        this.feedbackMessage.emit({
          type: 'error',
          title: 'Delete Failed',
          message: getHumanReadableHttpError(err, 'Could not delete the company record. Please verify server connection.')
        });
      }
    });
  }

  // --- Edit Actions ---
  onStartEdit(company: CompanyResponse, event?: Event): void {
    if (event) event.stopPropagation();
    if (!this.canEditCompany(company)) {
      this.feedbackMessage.emit({
        type: 'error',
        title: 'Access Restricted',
        message: 'You are only authorized to edit and update your own company.'
      });
      return;
    }
    if (this.selectedCompany()) {
      this.closeCompanyDetail();
    }
    this.editCompany.emit(company);
  }

  // --- Export Actions ---
  exportToExcel(): void {
    if (this.isExportingExcel()) return;
    this.isExportingExcel.set(true);
    this.companyService.exportCompaniesToExcel().subscribe({
      next: (blob: Blob) => {
        this.isExportingExcel.set(false);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        a.download = `companies_directory_${dateStr}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.feedbackMessage.emit({
          type: 'success',
          title: 'Excel Export Successful',
          message: 'The companies directory spreadsheet has been generated and downloaded.'
        });
      },
      error: (err) => {
        this.isExportingExcel.set(false);
        console.error('Excel export failed:', err);
        this.feedbackMessage.emit({
          type: 'error',
          title: 'Export Failed',
          message: getHumanReadableHttpError(err, 'Could not generate the Excel file. Please ensure the backend server is reachable.')
        });
      }
    });
  }

  exportToPdf(): void {
    if (this.isExportingPdf()) return;
    this.isExportingPdf.set(true);
    this.companyService.exportCompaniesToPdf().subscribe({
      next: (blob: Blob) => {
        this.isExportingPdf.set(false);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        a.download = `companies_directory_${dateStr}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.feedbackMessage.emit({
          type: 'success',
          title: 'PDF Export Successful',
          message: 'The companies directory official PDF document has been generated and downloaded.'
        });
      },
      error: (err) => {
        this.isExportingPdf.set(false);
        console.error('PDF export failed:', err);
        this.feedbackMessage.emit({
          type: 'error',
          title: 'Export Failed',
          message: getHumanReadableHttpError(err, 'Could not generate the PDF file. Please ensure the backend server is reachable.')
        });
      }
    });
  }

  downloadCompanyPdf(company: CompanyResponse, event?: Event): void {
    if (event) event.stopPropagation();
    if (!company || !company.id) {
      this.feedbackMessage.emit({
        type: 'error',
        title: 'Save Required',
        message: 'Please register and save this company record first before downloading the executive PDF profile.'
      });
      return;
    }

    if (this.isExportingCompanyPdf() === company.id) return;
    this.isExportingCompanyPdf.set(company.id);

    this.companyService.exportCompanyProfilePdf(company.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeName = (company.companyName || 'company').replace(/[^a-zA-Z0-9_-]/g, '_');
        a.href = url;
        a.download = `${safeName}_Profile_with_Cards.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.isExportingCompanyPdf.set(null);
      },
      error: (err) => {
        console.error('Failed to export company PDF profile:', err);
        this.isExportingCompanyPdf.set(null);
        this.feedbackMessage.emit({
          type: 'error',
          title: 'Export Failed',
          message: getHumanReadableHttpError(err, 'Could not generate company PDF profile with business cards. Please try again.')
        });
      }
    });
  }

  onOpenShare(company: CompanyResponse, event?: Event): void {
    if (event) event.stopPropagation();
    this.openShare.emit(company);
  }

  onNewRegistration(): void {
    this.newRegistration.emit();
  }
}
