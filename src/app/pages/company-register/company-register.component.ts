import { Component, OnInit, inject, signal, computed, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { CompanyService } from '../../core/services/company';
import { BrandService } from '../../core/services/brand';
import { ProductService } from '../../core/services/product';
import { CategoryService } from '../../core/services/category';
import { CompanyRequest, CompanyResponse, BusinessCardItem } from '../../core/models/company.model';
import { BrandResponse } from '../../core/models/brand.model';
import { ProductResponse, ScrapedProduct, ScrapeProductsResponse } from '../../core/models/product.model';
import { CategoryResponse } from '../../core/models/category.model';
import { AuthService } from '../../core/services/auth.service';
import { OcrService } from '../../core/services/ocr.service';
import { BusinessCardScanResult } from '../../core/models/ocr.model';
import { environment } from '../../../environments/environment';
import { RouterLink } from '@angular/router';
import { COUNTRY_OPTIONS, normalizeToCountryCode } from '../../core/models/country.model';
import { phoneValidator } from '../../core/validators/phone.validator';
import { scrollToFirstInvalidControl, isFormControlInvalid, allowOnlyPhoneChars, sanitizePhoneInput, handleFormEnterKey } from '../../core/utils/company-form.util';

import { CompanyShareModalComponent } from './components/company-share-modal/company-share-modal.component';
import { CompanyOcrModalComponent } from './components/company-ocr-modal/company-ocr-modal.component';
import { CompanyLivePreviewComponent } from './components/company-live-preview/company-live-preview.component';
import { SearchableCountrySelectComponent } from '../../core/components/searchable-country-select/searchable-country-select.component';
import { CompanyCatalogPickerComponent } from './components/company-catalog-picker/company-catalog-picker.component';
import { CompanyDirectoryComponent } from './components/company-directory/company-directory.component';
import { CompanyAssetUploadComponent } from './components/company-asset-upload/company-asset-upload.component';

@Component({
  selector: 'app-company-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    CompanyShareModalComponent,
    CompanyOcrModalComponent,
    CompanyLivePreviewComponent,
    SearchableCountrySelectComponent,
    CompanyCatalogPickerComponent,
    CompanyDirectoryComponent,
    CompanyAssetUploadComponent
  ],
  templateUrl: './company-register.component.html',
  styleUrl: './company-register.component.css'
})
export class CompanyRegisterComponent implements OnInit {
  @ViewChild('assetUpload') assetUploadComponent?: CompanyAssetUploadComponent;
  private readonly fb = inject(FormBuilder);
  readonly companyService = inject(CompanyService);
  readonly brandService = inject(BrandService);
  readonly productService = inject(ProductService);
  readonly categoryService = inject(CategoryService);
  readonly authService = inject(AuthService);
  readonly ocrService = inject(OcrService);
  readonly environment = environment;
  readonly countryOptions = COUNTRY_OPTIONS;
  readonly normalizeToCountryCode = normalizeToCountryCode;

  // Selected country tracking for preview & validation
  readonly selectedCountryCode = signal<string>('');

  readonly selectedCountryOption = computed(() => {
    const code = this.selectedCountryCode();
    if (!code) return null;
    return this.countryOptions.find(c => c.code.toUpperCase() === code.toUpperCase()) || { code, name: code };
  });

  onCountryChange(code: string): void {
    this.selectedCountryCode.set(code);
    this.companyForm.patchValue({ country: code });
    this.companyForm.get('country')?.markAsDirty();
    this.companyForm.get('country')?.markAsTouched();
  }

  // Business Card Scanner State
  readonly isOcrModalOpen = signal<boolean>(false);
  readonly ocrInitialFile = signal<File | null>(null);

  logout(): void {
    this.authService.logout();
  }


  readonly currentUser = this.authService.currentUser;

  // State Signals
  readonly isSubmitting = signal<boolean>(false);
  readonly isLoadingList = signal<boolean>(false);
  readonly isExportingCompanyPdf = signal<number | null>(null);
  readonly activeTab = signal<'register' | 'directory'>('register');
  readonly feedback = signal<{ type: 'success' | 'error'; title: string; message: string } | null>(null);

  // Edit State
  readonly editingCompanyId = signal<number | null>(null);
  readonly directorySelectedCompany = signal<CompanyResponse | null>(null);

  // Share Modal State
  readonly companyToShare = signal<CompanyResponse | null>(null);

  // File Upload State (Multiple Visiting Cards & Brand Assets)
  readonly businessCardItems = signal<BusinessCardItem[]>([]);

  // Computations for multiple files
  readonly selectedNewFiles = computed(() =>
    this.businessCardItems().filter(c => !c.isExisting && c.file).map(c => c.file as File)
  );

  readonly existingCardPaths = computed(() =>
    this.businessCardItems().filter(c => c.isExisting && c.path).map(c => c.path as string)
  );

  readonly primaryCardPreviewUrl = computed(() => {
    const firstImg = this.businessCardItems().find(c => !c.isPdf && c.url);
    return firstImg ? firstImg.url || null : null;
  });

  readonly filePreviewUrl = computed(() => this.primaryCardPreviewUrl());

  // Companies List State
  readonly companies = signal<CompanyResponse[]>([]);

  // Form Autofill State
  readonly formSearchQuery = signal<string>('');
  readonly isFormSearchFocused = signal<boolean>(false);

  // Registration Form Autofill Suggestions
  readonly formAutofillSuggestions = computed(() => {
    const q = this.formSearchQuery().toLowerCase().trim();
    if (!q) return [];
    return this.companies().filter(c =>
      c.companyName?.toLowerCase().includes(q) ||
      c.contactName?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    ).slice(0, 5);
  });

  // Company Name Live Suggestions State (Section 01)
  readonly isCompanyNameFocused = signal<boolean>(false);
  readonly companyNameInput = signal<string>('');
  readonly activeCompanyNameSuggestionIndex = signal<number>(-1);

  // Suggestions filtered when typing in the Company Name input
  readonly companyNameSuggestions = computed(() => {
    const q = this.companyNameInput().trim().toLowerCase();
    if (q.length < 2) return [];
    return this.companies()
      .filter(c => {
        const name = (c.companyName || '').toLowerCase().trim();
        // Match substring, but avoid suggesting the exact identical name already typed
        return name.includes(q) && name !== q;
      })
      .slice(0, 6);
  });

  // Check if current companyName input exactly matches an existing registered company
  readonly exactMatchedCompany = computed(() => {
    const q = this.companyNameInput().trim().toLowerCase();
    if (!q) return null;
    return this.companies().find(c => (c.companyName || '').toLowerCase().trim() === q) || null;
  });

  // Brand & Product Selection State (Shared with Catalog Picker and Live Preview)
  readonly availableBrands = signal<BrandResponse[]>([]);
  readonly selectedBrandIds = signal<number[]>([]);
  readonly isLoadingBrands = signal<boolean>(false);

  readonly availableProducts = signal<ProductResponse[]>([]);
  readonly selectedProductIds = signal<number[]>([]);
  readonly isLoadingProducts = signal<boolean>(false);

  readonly availableCategories = signal<CategoryResponse[]>([]);
  readonly isLoadingCategories = signal<boolean>(false);

  // Selected entities for live preview, form submission, and PDF export
  get selectedBrandsList(): BrandResponse[] {
    const ids = new Set(this.selectedBrandIds());
    return this.availableBrands().filter(b => ids.has(b.id));
  }

  readonly selectedProductsList = computed(() => {
    const ids = new Set(this.selectedProductIds());
    return this.availableProducts().filter(p => ids.has(p.id));
  });

  // Form Definition
  companyForm: FormGroup = this.fb.group({
    companyName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    landline: ['', [Validators.maxLength(30), phoneValidator()]],
    address: ['', [Validators.maxLength(255)]],
    city: ['', [Validators.maxLength(100)]],
    country: ['', [Validators.required, Validators.maxLength(100)]],
    website: ['', [Validators.maxLength(255)]],
    description: ['', [Validators.maxLength(1000)]],
    status: ['ACTIVE', [Validators.required]],
    contactName: ['', [Validators.maxLength(150)]],
    contactDesignation: ['', [Validators.maxLength(100)]],
    contactEmail: ['', [Validators.email, Validators.maxLength(150)]],
    contactMobileNumber: ['', [Validators.maxLength(30), phoneValidator()]]
  });

  scrollToSection(sectionId: string, event?: Event): void {
    if (event) event.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  setStatus(status: 'ACTIVE' | 'PENDING' | 'INACTIVE'): void {
    this.companyForm.patchValue({ status });
    this.companyForm.get('status')?.markAsDirty();
    this.companyForm.get('status')?.markAsTouched();
  }

  ngOnInit(): void {
    this.fetchCompanies();
    this.fetchBrands();
    this.fetchProducts();
    this.fetchCategories();

    // Synchronize companyNameInput signal with reactive form control value changes
    this.companyForm.get('companyName')?.valueChanges.subscribe(val => {
      this.companyNameInput.set(val || '');
    });

    // Synchronize selectedCountryCode signal with reactive form control value changes
    this.companyForm.get('country')?.valueChanges.subscribe(val => {
      this.selectedCountryCode.set(val || '');
    });
  }

  fetchCompanies(): void {
    this.isLoadingList.set(true);
    this.companyService.getAllCompanies().subscribe({
      next: (data) => {
        const mapped = (data || []).map(c => ({
          ...c,
          country: normalizeToCountryCode(c.country)
        }));
        this.companies.set(mapped);
        this.isLoadingList.set(false);
      },
      error: (err) => {
        console.error('Failed to load companies:', err);
        this.isLoadingList.set(false);
      }
    });
  }



  fetchBrands(): void {
    this.isLoadingBrands.set(true);
    this.brandService.getAllBrands().subscribe({
      next: (data) => {
        this.availableBrands.set(data || []);
        this.isLoadingBrands.set(false);
      },
      error: (err) => {
        console.error('Failed to load brands:', err);
        this.isLoadingBrands.set(false);
      }
    });
  }

  fetchProducts(): void {
    this.isLoadingProducts.set(true);
    this.productService.getAllProducts().subscribe({
      next: (data) => {
        this.availableProducts.set(data || []);
        this.isLoadingProducts.set(false);
      },
      error: (err) => {
        console.error('Failed to load products:', err);
        this.isLoadingProducts.set(false);
      }
    });
  }

  fetchCategories(): void {
    this.isLoadingCategories.set(true);
    this.categoryService.getAllCategories().subscribe({
      next: (data) => {
        this.availableCategories.set(data || []);
        this.isLoadingCategories.set(false);
      },
      error: (err) => {
        console.error('Failed to load categories:', err);
        this.isLoadingCategories.set(false);
      }
    });
  }

  // --- File Upload & OCR Helper Handlers ---
  onOcrFileSelectedFromUpload(file: File): void {
    this.ocrInitialFile.set(file);
    this.isOcrModalOpen.set(true);
  }

  removeFile(event?: Event): void {
    if (event) event.stopPropagation();
    this.businessCardItems.set([]);
  }

  getCompanyCards(company: CompanyResponse): string[] {
    if (company.businessCards && company.businessCards.length > 0) {
      return company.businessCards;
    }
    return company.businessCard ? [company.businessCard] : [];
  }

  // --- Form Submission (Create or Update) ---
  onSubmit(): void {
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      this.scrollToFirstInvalidControl();
      return;
    }

    this.isSubmitting.set(true);
    this.feedback.set(null);

    const formValues = this.companyForm.value;
    const requestData: CompanyRequest = {
      companyName: formValues.companyName.trim(),
      email: formValues.email.trim(),
      landline: formValues.landline ? formValues.landline.trim() : '',
      address: formValues.address ? formValues.address.trim() : '',
      city: formValues.city ? formValues.city.trim() : '',
      country: formValues.country ? normalizeToCountryCode(formValues.country) : '',
      website: formValues.website ? formValues.website.trim() : '',
      description: formValues.description ? formValues.description.trim() : '',
      status: formValues.status || 'ACTIVE',
      contactName: formValues.contactName ? formValues.contactName.trim() : '',
      contactDesignation: formValues.contactDesignation ? formValues.contactDesignation.trim() : '',
      contactEmail: formValues.contactEmail ? formValues.contactEmail.trim() : '',
      contactMobileNumber: formValues.contactMobileNumber ? formValues.contactMobileNumber.trim() : '',
      // Ensure all brands of the chosen products are included
      brandIds: Array.from(
        new Set([
          ...this.selectedBrandIds(),
          ...this.selectedProductsList().map(p => p.brandId).filter(Boolean) as number[]
        ])
      ),
      productIds: this.selectedProductIds(),
      existingBusinessCards: this.existingCardPaths()
    };

    const filesToUpload = this.selectedNewFiles();
    const editId = this.editingCompanyId();

    if (editId) {
      // Update existing company
      this.companyService.updateCompany(editId, requestData, filesToUpload).subscribe({
        next: (response) => {
          this.isSubmitting.set(false);
          this.feedback.set({
            type: 'success',
            title: 'Company Updated Successfully!',
            message: `Changes for "${response.companyName}" (ID #${response.id}) have been saved.`
          });
          this.editingCompanyId.set(null);
          this.resetForm();
          this.fetchCompanies();
          this.activeTab.set('directory');
        },
        error: (err) => {
          this.isSubmitting.set(false);
          console.error('Update failed:', err);
          const errMsg = err?.error?.message || err?.message || 'Server error occurred during company update.';
          this.feedback.set({
            type: 'error',
            title: 'Update Failed',
            message: errMsg
          });
        }
      });
    } else {
      // Create new company
      this.companyService.createCompany(requestData, filesToUpload).subscribe({
        next: (response) => {
          this.isSubmitting.set(false);
          this.feedback.set({
            type: 'success',
            title: 'Company Registered Successfully!',
            message: `"${response.companyName}" has been established with ID #${response.id}.`
          });
          this.resetForm();
          this.fetchCompanies();
          this.activeTab.set('directory');
        },
        error: (err) => {
          this.isSubmitting.set(false);
          console.error('Registration failed:', err);
          const errMsg = err?.error?.message || err?.message || 'Server error occurred during company creation.';
          this.feedback.set({
            type: 'error',
            title: 'Registration Failed',
            message: `${errMsg}. Please ensure the server is reachable and try again.`
          });
        }
      });
    }
  }

  // --- Role & Ownership Permissions ---
  canEditCompany(company?: CompanyResponse | null): boolean {
    if (!company) return false;
    if (this.authService.isSuperAdmin()) {
      return true;
    }
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      return false;
    }
    // Match by registered owner userId or fallback to company contact/creator email
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

  // --- Edit Actions ---
  startEdit(company: CompanyResponse, event?: Event): void {
    if (event) event.stopPropagation();
    if (!this.canEditCompany(company)) {
      this.feedback.set({
        type: 'error',
        title: 'Access Restricted',
        message: 'You are only authorized to edit and update your own company.'
      });
      return;
    }
    this.editingCompanyId.set(company.id);

    this.companyForm.patchValue({
      companyName: company.companyName || '',
      email: company.email || '',
      landline: company.landline || '',
      address: company.address || '',
      city: company.city || '',
      country: normalizeToCountryCode(company.country) || '',
      website: company.website || '',
      description: company.description || '',
      status: company.status || 'ACTIVE',
      contactName: company.contactName || '',
      contactDesignation: company.contactDesignation || '',
      contactEmail: company.contactEmail || '',
      contactMobileNumber: company.contactMobileNumber || ''
    });

    // Populate selected brands
    const brandIds = (company.brandIds && company.brandIds.length > 0)
      ? company.brandIds
      : (company.brands?.map(b => b.id) || []);
    this.selectedBrandIds.set(brandIds);

    // Populate selected products
    const productIds = (company.productIds && company.productIds.length > 0)
      ? company.productIds
      : (company.products?.map(p => p.id) || []);
    this.selectedProductIds.set(productIds);

    // Populate multiple business cards
    const items: BusinessCardItem[] = [];
    const serverCards = (company.businessCards && company.businessCards.length > 0)
      ? company.businessCards
      : (company.businessCard ? [company.businessCard] : []);

    serverCards.forEach((path, idx) => {
      const isPdf = path.toLowerCase().endsWith('.pdf');
      items.push({
        id: `existing-${idx}-${path}`,
        name: path.split('/').pop() || `Visiting Card ${idx + 1}`,
        path: path,
        url: this.companyService.getFileUrl(path),
        isPdf: isPdf,
        isExisting: true
      });
    });
    this.businessCardItems.set(items);
    this.activeTab.set('register');
  }

  cancelEdit(): void {
    this.editingCompanyId.set(null);
    this.resetForm();
  }

  switchToRegister(): void {
    this.cancelEdit();
    this.activeTab.set('register');
  }

  viewCompanyInDirectory(company: CompanyResponse): void {
    this.directorySelectedCompany.set(company);
    this.activeTab.set('directory');
  }

  // --- Form Reset & Navigation ---
  resetForm(): void {
    this.companyForm.reset({
      companyName: '',
      email: '',
      landline: '',
      address: '',
      city: '',
      country: '',
      website: '',
      description: '',
      status: 'ACTIVE',
      contactName: '',
      contactDesignation: '',
      contactEmail: '',
      contactMobileNumber: ''
    });
    this.selectedBrandIds.set([]);
    this.selectedProductIds.set([]);
    this.removeFile();
  }

  closeFeedback(): void {
    this.feedback.set(null);
  }

  // --- Registration Form Quick Autofill ---
  onFormSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.formSearchQuery.set(input.value);
    this.isFormSearchFocused.set(true);
  }

  onFormSearchFocus(): void {
    this.isFormSearchFocused.set(true);
  }

  onFormSearchBlur(): void {
    setTimeout(() => {
      this.isFormSearchFocused.set(false);
    }, 220);
  }

  clearFormSearch(): void {
    this.formSearchQuery.set('');
  }

  autofillFormWithCompany(company: CompanyResponse): void {
    this.companyForm.patchValue({
      companyName: company.companyName ? `${company.companyName} (Copy)` : '',
      email: company.email || '',
      landline: company.landline || '',
      address: company.address || '',
      city: company.city || '',
      country: normalizeToCountryCode(company.country) || '',
      website: company.website || '',
      description: company.description || '',
      status: company.status || 'ACTIVE',
      contactName: company.contactName || '',
      contactDesignation: company.contactDesignation || '',
      contactEmail: company.contactEmail || '',
      contactMobileNumber: company.contactMobileNumber || ''
    });

    const brandIds = (company.brandIds && company.brandIds.length > 0)
      ? company.brandIds
      : (company.brands?.map(b => b.id) || []);
    this.selectedBrandIds.set(brandIds);

    const productIds = (company.productIds && company.productIds.length > 0)
      ? company.productIds
      : (company.products?.map(p => p.id) || []);
    this.selectedProductIds.set(productIds);

    this.formSearchQuery.set('');
    this.isFormSearchFocused.set(false);

    this.feedback.set({
      type: 'success',
      title: 'Company Autofilled',
      message: `Form populated with template details from "${company.companyName}". Review and submit when ready.`
    });
  }

  // --- Company Name Live Search Handlers (Section 01) ---
  onCompanyNameFocus(): void {
    this.isCompanyNameFocused.set(true);
    this.activeCompanyNameSuggestionIndex.set(-1);
  }

  onCompanyNameBlur(): void {
    setTimeout(() => {
      this.isCompanyNameFocused.set(false);
      this.activeCompanyNameSuggestionIndex.set(-1);
    }, 220);
  }

  selectCompanyNameSuggestion(company: CompanyResponse): void {
    this.companyForm.patchValue({ companyName: company.companyName });
    this.companyForm.get('companyName')?.markAsDirty();
    this.companyNameInput.set(company.companyName);
    this.isCompanyNameFocused.set(false);
    this.activeCompanyNameSuggestionIndex.set(-1);
  }

  onCompanyNameKeydown(event: KeyboardEvent): void {
    const suggestions = this.companyNameSuggestions();
    if (!this.isCompanyNameFocused() || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const current = this.activeCompanyNameSuggestionIndex();
      const next = current + 1 >= suggestions.length ? 0 : current + 1;
      this.activeCompanyNameSuggestionIndex.set(next);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const current = this.activeCompanyNameSuggestionIndex();
      const prev = current <= 0 ? suggestions.length - 1 : current - 1;
      this.activeCompanyNameSuggestionIndex.set(prev);
    } else if (event.key === 'Enter') {
      const idx = this.activeCompanyNameSuggestionIndex();
      if (idx >= 0 && idx < suggestions.length) {
        event.preventDefault();
        this.selectCompanyNameSuggestion(suggestions[idx]);
      }
    } else if (event.key === 'Escape') {
      this.isCompanyNameFocused.set(false);
      this.activeCompanyNameSuggestionIndex.set(-1);
    }
  }

  // Auto-scrolls and highlights the first invalid or empty required field
  private scrollToFirstInvalidControl(): void {
    scrollToFirstInvalidControl(this.companyForm, fb => this.feedback.set(fb));
  }

  // Helpers for validation styling
  isInvalid(controlName: string): boolean {
    return isFormControlInvalid(this.companyForm, controlName);
  }

  // --- Phone Number Input Restriction & Sanitization ---
  allowOnlyPhoneChars(event: KeyboardEvent): void {
    allowOnlyPhoneChars(event);
  }

  sanitizePhoneInput(event: Event, controlName: 'contactMobileNumber' | 'landline'): void {
    sanitizePhoneInput(event, this.companyForm, controlName);
  }

  // --- Keyboard Navigation: Advance to next field on Enter ---
  onFormKeydown(event: KeyboardEvent): void {
    handleFormEnterKey(event);
  }

  // ==========================================
  // SHARE SYSTEM HANDLERS
  // ==========================================
  openShareModal(company: CompanyResponse, event?: Event): void {
    if (event) event.stopPropagation();
    this.companyToShare.set(company);
  }

  closeShareModal(): void {
    this.companyToShare.set(null);
  }

  shareCurrentPreview(): void {
    const formVal = this.companyForm.value;
    const previewCompany: CompanyResponse = {
      id: this.editingCompanyId() || 0,
      companyName: formVal.companyName || 'Untitled Company',
      email: formVal.email || '',
      landline: formVal.landline,
      address: formVal.address,
      city: formVal.city,
      country: formVal.country,
      website: formVal.website,
      description: formVal.description,
      status: formVal.status || 'ACTIVE',
      contactName: formVal.contactName,
      contactDesignation: formVal.contactDesignation,
      contactEmail: formVal.contactEmail,
      contactMobileNumber: formVal.contactMobileNumber,
      brands: this.selectedBrandsList,
      products: this.selectedProductsList()
    };
    this.openShareModal(previewCompany);
  }

  downloadCompanyPdf(company: CompanyResponse, event?: Event): void {
    if (event) event.stopPropagation();
    if (!company || !company.id) {
      this.feedback.set({
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
        this.feedback.set({
          type: 'error',
          title: 'Export Failed',
          message: 'Could not generate company PDF profile with business cards. Please try again.'
        });
      }
    });
  }

  // ==========================================
  // OCR BUSINESS CARD SCANNER HANDLERS
  // ==========================================
  openOcrModal(): void {
    this.ocrInitialFile.set(null);
    this.isOcrModalOpen.set(true);
  }

  closeOcrModal(): void {
    this.isOcrModalOpen.set(false);
    this.ocrInitialFile.set(null);
  }

  onOcrFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.ocrInitialFile.set(input.files[0]);
      this.isOcrModalOpen.set(true);
      input.value = '';
    }
  }

  scanExistingCard(item: BusinessCardItem, event?: Event): void {
    if (event) event.stopPropagation();
    if (item.file) {
      this.ocrInitialFile.set(item.file);
      this.isOcrModalOpen.set(true);
    } else if (item.url) {
      fetch(item.url)
        .then(res => res.blob())
        .then(blob => {
          const mimeType = item.isPdf ? 'application/pdf' : (blob.type || 'image/jpeg');
          const file = new File([blob], item.name, { type: mimeType });
          this.ocrInitialFile.set(file);
          this.isOcrModalOpen.set(true);
        })
        .catch(err => {
          console.error('Failed to load card for OCR:', err);
          this.feedback.set({
            type: 'error',
            title: 'File Load Error',
            message: 'Unable to access the visiting card file for scanning.'
          });
        });
    }
  }

  handleOcrApply(data: { result: BusinessCardScanResult; file: File | null; autoAttach: boolean }): void {
    const { result: res, file, autoAttach } = data;
    const finalCountry = normalizeToCountryCode(res.country) || '';
    const currentValues = this.companyForm.value;

    const rawMobile = res.contactMobileNumber || currentValues.contactMobileNumber || '';
    const cleanMobile = rawMobile ? rawMobile.replace(/[^0-9+\-\s().]/g, '').trim() : '';

    const rawLandline = res.landline || currentValues.landline || '';
    const cleanLandline = rawLandline ? rawLandline.replace(/[^0-9+\-\s().]/g, '').trim() : '';

    this.companyForm.patchValue({
      companyName: res.companyName || currentValues.companyName,
      contactName: res.contactName || currentValues.contactName,
      contactDesignation: res.contactDesignation || currentValues.contactDesignation,
      email: res.email || currentValues.email,
      contactEmail: res.contactEmail || res.email || currentValues.contactEmail,
      contactMobileNumber: cleanMobile,
      landline: cleanLandline,
      website: res.website || currentValues.website,
      address: res.address || currentValues.address,
      city: res.city || currentValues.city,
      country: finalCountry
    });
    this.companyForm.get('country')?.markAsDirty();
    this.companyForm.get('country')?.markAsTouched();
    this.selectedCountryCode.set(finalCountry);

    if (autoAttach && file) {
      const alreadyAdded = this.businessCardItems().some(c => c.name === file.name && c.size === file.size);
      if (!alreadyAdded) {
        this.assetUploadComponent?.addFiles([file]);
      }
    }

    this.isOcrModalOpen.set(false);
    this.ocrInitialFile.set(null);
    this.feedback.set({
      type: 'success',
      title: 'Business Card Details Applied! 🎉',
      message: `Extracted company "${res.companyName || 'Detected'}", contact "${res.contactName || 'Detected'}" and related details have auto-filled into the form.`
    });
  }

  handleOcrError(msg: string): void {
    this.feedback.set({
      type: 'error',
      title: 'Scanning Failed',
      message: msg
    });
  }
}

