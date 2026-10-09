import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { CompanyService } from '../../core/services/company';
import { BrandService } from '../../core/services/brand';
import { ProductService } from '../../core/services/product';
import { CategoryService } from '../../core/services/category';
import { CompanyRequest, CompanyResponse } from '../../core/models/company.model';
import { BrandResponse } from '../../core/models/brand.model';
import { ProductResponse } from '../../core/models/product.model';
import { CategoryResponse } from '../../core/models/category.model';
import { AuthService } from '../../core/services/auth.service';
import { OcrService } from '../../core/services/ocr.service';
import { BusinessCardScanResult } from '../../core/models/ocr.model';
import { environment } from '../../../environments/environment';

import { RouterLink } from '@angular/router';

export interface BusinessCardItem {
  id: string;
  name: string;
  url?: string;
  path?: string;
  isPdf: boolean;
  isExisting: boolean;
  file?: File;
  size?: number;
}

@Component({
  selector: 'app-company-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './company-register.component.html',
  styleUrl: './company-register.component.css'
})
export class CompanyRegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly companyService = inject(CompanyService);
  readonly brandService = inject(BrandService);
  readonly productService = inject(ProductService);
  readonly categoryService = inject(CategoryService);
  readonly authService = inject(AuthService);
  readonly ocrService = inject(OcrService);
  readonly environment = environment;

  readonly currentUser = this.authService.currentUser;

  // OCR Business Card Scanner State
  readonly isOcrModalOpen = signal<boolean>(false);
  readonly isScanningCard = signal<boolean>(false);
  readonly scannedCardResult = signal<BusinessCardScanResult | null>(null);
  readonly scannedCardPreview = signal<string | null>(null);
  readonly scannedCardFile = signal<File | null>(null);
  readonly showRawOcrText = signal<boolean>(false);
  readonly isOcrSettingsOpen = signal<boolean>(false);
  readonly ocrApiKeyInput = signal<string>('');
  readonly autoAttachScannedCard = signal<boolean>(true);
  readonly ocrDragOver = signal<boolean>(false);
  readonly isUsingLiveVision = computed(() => this.ocrService.hasConfiguredKey());

  logout(): void {
    this.authService.logout();
  }


  // State Signals
  readonly isSubmitting = signal<boolean>(false);
  readonly isLoadingList = signal<boolean>(false);
  readonly isExportingExcel = signal<boolean>(false);
  readonly isExportingPdf = signal<boolean>(false);
  readonly isExportingCompanyPdf = signal<number | null>(null);
  readonly activeTab = signal<'register' | 'directory'>('register');
  readonly feedback = signal<{ type: 'success' | 'error'; title: string; message: string } | null>(null);

  // Edit State
  readonly editingCompanyId = signal<number | null>(null);

  // Delete Confirmation State
  readonly companyToDelete = signal<CompanyResponse | null>(null);
  readonly isDeleting = signal<boolean>(false);

  // Share Modal State
  readonly companyToShare = signal<CompanyResponse | null>(null);
  readonly isCopied = signal<boolean>(false);
  readonly canNativeShare = signal<boolean>(typeof navigator !== 'undefined' && typeof navigator.share === 'function');

  // File Upload State (Multiple Visiting Cards & Brand Assets)
  readonly businessCardItems = signal<BusinessCardItem[]>([]);
  readonly isDragOver = signal<boolean>(false);

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

  // Signal-like compatibility accessors for existing template bindings
  readonly selectedFile = computed(() => {
    const newFiles = this.selectedNewFiles();
    return newFiles.length > 0 ? newFiles[0] : null;
  });

  readonly filePreviewUrl = computed(() => this.primaryCardPreviewUrl());

  readonly isPdfFile = computed(() => {
    const items = this.businessCardItems();
    return items.length > 0 && items[0].isPdf;
  });

  // Companies List State
  readonly companies = signal<CompanyResponse[]>([]);
  readonly searchQuery = signal<string>('');
  readonly isSearchFocused = signal<boolean>(false);
  readonly activeAutofillIndex = signal<number>(-1);

  // Form Autofill State
  readonly formSearchQuery = signal<string>('');
  readonly isFormSearchFocused = signal<boolean>(false);

  // Searchbar Suggestions (Directory Search)
  readonly searchSuggestions = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.companies();
    if (!q) {
      // Suggest top 5 recent/active companies when search input is focused
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

  // Brand Association State (Brands Dealt With)
  readonly availableBrands = signal<BrandResponse[]>([]);
  readonly selectedBrandIds = signal<number[]>([]);
  readonly manuallySelectedBrandIds = signal<Set<number>>(new Set<number>());
  readonly isLoadingBrands = signal<boolean>(false);
  readonly brandSearchQuery = signal<string>('');

  // Product & Category Association State (Choose Products from Brands through Categories)
  readonly availableProducts = signal<ProductResponse[]>([]);
  readonly selectedProductIds = signal<number[]>([]);
  readonly isLoadingProducts = signal<boolean>(false);
  readonly availableCategories = signal<CategoryResponse[]>([]);
  readonly isLoadingCategories = signal<boolean>(false);

  // Product Selection Filters
  readonly productSearchQuery = signal<string>('');
  readonly activeProductBrandFilter = signal<string>('all');
  readonly activeProductCategoryFilter = signal<string>('all');
  readonly activeProductSubCategoryFilter = signal<string>('all');

  // Selected Company for View Modal
  readonly selectedCompany = signal<CompanyResponse | null>(null);

  // Hierarchy Data Computations
  readonly parentCategories = computed(() =>
    this.availableCategories().filter(c => c.parentId == null)
  );

  readonly subCategories = computed(() => {
    const parents = this.parentCategories();
    return this.availableCategories()
      .filter(c => c.parentId != null)
      .map(sub => ({
        ...sub,
        parentName: parents.find(p => p.id === sub.parentId)?.name || 'None'
      }));
  });

  // Brands with Product Counts
  readonly brandsWithProducts = computed(() => {
    const products = this.availableProducts();
    return this.availableBrands().map(b => ({
      ...b,
      productCount: products.filter(p => p.brandId === b.id).length
    }));
  });

  // Categories with products for the currently active brand filter
  readonly availableCategoriesForBrand = computed(() => {
    const brandFilter = this.activeProductBrandFilter();
    let prods = this.availableProducts();
    if (brandFilter !== 'all') {
      const bId = Number(brandFilter);
      prods = prods.filter(p => p.brandId === bId);
    }
    const catIds = new Set(prods.map(p => p.categoryId));
    return this.parentCategories().filter(c => catIds.has(c.id));
  });

  // Subcategories available under the selected Brand and Main Category
  readonly availableSubCategoriesForSelection = computed(() => {
    const brandFilter = this.activeProductBrandFilter();
    const catFilter = this.activeProductCategoryFilter();
    let prods = this.availableProducts();
    if (brandFilter !== 'all') {
      const bId = Number(brandFilter);
      prods = prods.filter(p => p.brandId === bId);
    }
    if (catFilter !== 'all') {
      const cId = Number(catFilter);
      prods = prods.filter(p => p.categoryId === cId);
    }
    const subCatIds = new Set(prods.filter(p => p.subCategoryId).map(p => p.subCategoryId as number));
    return this.subCategories().filter(s => subCatIds.has(s.id));
  });

  // Filtered Products for selection in "Choose products from brands through categories"
  readonly filteredAvailableProducts = computed(() => {
    const brandFilter = this.activeProductBrandFilter();
    const catFilter = this.activeProductCategoryFilter();
    const subCatFilter = this.activeProductSubCategoryFilter();
    const query = this.productSearchQuery().toLowerCase().trim();

    return this.availableProducts().filter(p => {
      if (brandFilter !== 'all' && p.brandId !== Number(brandFilter)) return false;
      if (catFilter !== 'all' && p.categoryId !== Number(catFilter)) return false;
      if (subCatFilter !== 'all' && p.subCategoryId !== Number(subCatFilter)) return false;

      if (query) {
        const matches =
          p.name?.toLowerCase().includes(query) ||
          p.brandName?.toLowerCase().includes(query) ||
          p.categoryName?.toLowerCase().includes(query) ||
          p.subCategoryName?.toLowerCase().includes(query) ||
          p.id?.toString().includes(query);
        if (!matches) return false;
      }
      return true;
    });
  });

  // List of selected product entities
  readonly selectedProductsList = computed(() => {
    const ids = new Set(this.selectedProductIds());
    return this.availableProducts().filter(p => ids.has(p.id));
  });

  // Form Definition
  companyForm: FormGroup = this.fb.group({
    companyName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    landline: ['', [Validators.maxLength(30)]],
    address: ['', [Validators.maxLength(255)]],
    city: ['', [Validators.maxLength(100)]],
    country: ['United States', [Validators.maxLength(100)]],
    website: ['', [Validators.maxLength(255)]],
    description: ['', [Validators.maxLength(1000)]],
    status: ['ACTIVE', [Validators.required]],
    contactName: ['', [Validators.maxLength(150)]],
    contactDesignation: ['', [Validators.maxLength(100)]],
    contactEmail: ['', [Validators.email, Validators.maxLength(150)]],
    contactMobileNumber: ['', [Validators.maxLength(30)]]
  });

  ngOnInit(): void {
    this.fetchCompanies();
    this.fetchBrands();
    this.fetchProducts();
    this.fetchCategories();
  }

  fetchCompanies(): void {
    this.isLoadingList.set(true);
    this.companyService.getAllCompanies().subscribe({
      next: (data) => {
        this.companies.set(data || []);
        this.isLoadingList.set(false);
      },
      error: (err) => {
        console.error('Failed to load companies:', err);
        this.isLoadingList.set(false);
      }
    });
  }

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
        this.feedback.set({
          type: 'success',
          title: 'Excel Export Successful',
          message: 'The companies directory spreadsheet has been generated and downloaded.'
        });
      },
      error: (err) => {
        this.isExportingExcel.set(false);
        console.error('Excel export failed:', err);
        this.feedback.set({
          type: 'error',
          title: 'Export Failed',
          message: 'Could not generate the Excel file. Please ensure the backend server is reachable.'
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
        this.feedback.set({
          type: 'success',
          title: 'PDF Export Successful',
          message: 'The companies directory official PDF document has been generated and downloaded.'
        });
      },
      error: (err) => {
        this.isExportingPdf.set(false);
        console.error('PDF export failed:', err);
        this.feedback.set({
          type: 'error',
          title: 'Export Failed',
          message: 'Could not generate the PDF file. Please ensure the backend server is reachable.'
        });
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

  // --- Brand Selection Handlers ---
  toggleBrand(brandId: number): void {
    const current = this.selectedBrandIds();
    if (current.includes(brandId)) {
      // 1. Unselect brand
      this.selectedBrandIds.set(current.filter(id => id !== brandId));
      this.manuallySelectedBrandIds.update(set => {
        const next = new Set(set);
        next.delete(brandId);
        return next;
      });
      // 2. Cascade: automatically unselect all products belonging to this brand
      const productsOfThisBrand = new Set(
        this.availableProducts().filter(p => p.brandId === brandId).map(p => p.id)
      );
      this.selectedProductIds.set(
        this.selectedProductIds().filter(id => !productsOfThisBrand.has(id))
      );
    } else {
      // User explicitly selected this brand in Section 05
      this.selectedBrandIds.set([...current, brandId]);
      this.manuallySelectedBrandIds.update(set => new Set(set).add(brandId));
    }
  }

  isBrandSelected(brandId: number): boolean {
    return this.selectedBrandIds().includes(brandId);
  }

  selectAllBrands(): void {
    const allIds = this.availableBrands().map(b => b.id);
    this.selectedBrandIds.set(allIds);
    this.manuallySelectedBrandIds.set(new Set(allIds));
  }

  clearSelectedBrands(): void {
    this.selectedBrandIds.set([]);
    this.manuallySelectedBrandIds.set(new Set());
    // Cascade: clearing all brands also clears all chosen products
    this.selectedProductIds.set([]);
  }

  get filteredAvailableBrands(): BrandResponse[] {
    const query = this.brandSearchQuery().toLowerCase().trim();
    if (!query) return this.availableBrands();
    return this.availableBrands().filter(b => b.brandName?.toLowerCase().includes(query));
  }

  get selectedBrandsList(): BrandResponse[] {
    const ids = new Set(this.selectedBrandIds());
    return this.availableBrands().filter(b => ids.has(b.id));
  }

  // --- Product Selection Handlers (From Brands through Categories) ---
  toggleProduct(product: ProductResponse): void {
    const current = this.selectedProductIds();
    if (current.includes(product.id)) {
      this.removeProductAndCheckBrand(product.id, product.brandId);
    } else {
      this.selectedProductIds.set([...current, product.id]);
      // Ensure product's brand is also selected in company brands
      if (product.brandId && !this.selectedBrandIds().includes(product.brandId)) {
        this.selectedBrandIds.set([...this.selectedBrandIds(), product.brandId]);
      }
    }
  }

  private removeProductAndCheckBrand(productId: number, brandId?: number): void {
    const updatedProdIds = this.selectedProductIds().filter(id => id !== productId);
    this.selectedProductIds.set(updatedProdIds);

    const bId = brandId || this.availableProducts().find(p => p.id === productId)?.brandId;
    if (bId) {
      // Check if any other selected product belongs to this brand
      const hasOtherProductsOfBrand = this.availableProducts().some(
        p => p.brandId === bId && updatedProdIds.includes(p.id)
      );
      // If no other products from this brand are selected and it wasn't manually selected in Section 05, auto-unselect brand
      if (!hasOtherProductsOfBrand && !this.manuallySelectedBrandIds().has(bId)) {
        this.selectedBrandIds.set(this.selectedBrandIds().filter(id => id !== bId));
      }
    }
  }

  isProductSelected(productId: number): boolean {
    return this.selectedProductIds().includes(productId);
  }

  selectAllFilteredProducts(): void {
    const currentProdIds = new Set(this.selectedProductIds());
    const brandIds = new Set(this.selectedBrandIds());
    for (const p of this.filteredAvailableProducts()) {
      currentProdIds.add(p.id);
      if (p.brandId) brandIds.add(p.brandId);
    }
    this.selectedProductIds.set(Array.from(currentProdIds));
    this.selectedBrandIds.set(Array.from(brandIds));
  }

  deselectFilteredProducts(): void {
    const filteredIds = new Set(this.filteredAvailableProducts().map(p => p.id));
    const remainingProdIds = this.selectedProductIds().filter(id => !filteredIds.has(id));
    this.selectedProductIds.set(remainingProdIds);

    // Synchronize brands: if brand was only auto-selected by a product and has 0 products remaining, unselect it
    const remainingProds = this.availableProducts().filter(p => remainingProdIds.includes(p.id));
    const activeBrandIdsFromProds = new Set(remainingProds.map(p => p.brandId).filter(Boolean));

    this.selectedBrandIds.set(
      this.selectedBrandIds().filter(bId =>
        this.manuallySelectedBrandIds().has(bId) || activeBrandIdsFromProds.has(bId)
      )
    );
  }

  clearSelectedProducts(): void {
    this.selectedProductIds.set([]);
    // Remove brands that were only auto-selected by products
    this.selectedBrandIds.set(
      this.selectedBrandIds().filter(bId => this.manuallySelectedBrandIds().has(bId))
    );
  }

  removeSelectedProduct(productId: number): void {
    this.removeProductAndCheckBrand(productId);
  }

  setProductBrandFilter(brandIdStr: string): void {
    this.activeProductBrandFilter.set(brandIdStr);
    this.activeProductCategoryFilter.set('all');
    this.activeProductSubCategoryFilter.set('all');
  }

  setProductCategoryFilter(catIdStr: string): void {
    this.activeProductCategoryFilter.set(catIdStr);
    this.activeProductSubCategoryFilter.set('all');
  }

  // --- File Drag & Drop & Multi-Selection Handlers ---
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.handleFiles(Array.from(event.dataTransfer.files));
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFiles(Array.from(input.files));
      input.value = '';
    }
  }

  private handleFiles(files: File[]): void {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    const maxSizeBytes = 20 * 1024 * 1024; // 20 MB

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        this.feedback.set({
          type: 'error',
          title: 'Unsupported File Format',
          message: `"${file.name}" has an unsupported format. Please upload JPEG, PNG, WEBP, GIF, or PDF.`
        });
        continue;
      }

      if (file.size > maxSizeBytes) {
        this.feedback.set({
          type: 'error',
          title: 'File Too Large',
          message: `"${file.name}" exceeds the 20MB limit.`
        });
        continue;
      }

      const isPdf = file.type === 'application/pdf';
      const id = 'new-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

      if (isPdf) {
        this.businessCardItems.update(items => [
          ...items,
          {
            id,
            name: file.name,
            isPdf: true,
            isExisting: false,
            file,
            size: file.size
          }
        ]);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.businessCardItems.update(items => [
            ...items,
            {
              id,
              name: file.name,
              url: e.target?.result as string,
              isPdf: false,
              isExisting: false,
              file,
              size: file.size
            }
          ]);
        };
        reader.readAsDataURL(file);
      }
    }
  }

  removeCardItem(item: BusinessCardItem, event?: Event): void {
    if (event) event.stopPropagation();
    this.businessCardItems.update(items => items.filter(c => c.id !== item.id));
  }

  clearAllCards(event?: Event): void {
    if (event) event.stopPropagation();
    this.businessCardItems.set([]);
  }

  removeFile(event?: Event): void {
    this.clearAllCards(event);
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
      this.feedback.set({
        type: 'error',
        title: 'Validation Error',
        message: 'Please fill in all mandatory fields correctly before proceeding.'
      });
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
      country: formValues.country ? formValues.country.trim() : '',
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

  // --- Edit Actions ---
  startEdit(company: CompanyResponse, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingCompanyId.set(company.id);

    this.companyForm.patchValue({
      companyName: company.companyName || '',
      email: company.email || '',
      landline: company.landline || '',
      address: company.address || '',
      city: company.city || '',
      country: company.country || 'United States',
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
    this.manuallySelectedBrandIds.set(new Set(brandIds));

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

    if (this.selectedCompany()) {
      this.closeCompanyDetail();
    }

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

  // --- Delete Actions ---
  promptDelete(company: CompanyResponse, event?: Event): void {
    if (event) event.stopPropagation();
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
        this.feedback.set({
          type: 'success',
          title: 'Company Deleted',
          message: `"${toDelete.companyName}" has been successfully deleted.`
        });
        if (this.selectedCompany()?.id === toDelete.id) {
          this.closeCompanyDetail();
        }
        if (this.editingCompanyId() === toDelete.id) {
          this.cancelEdit();
        }
        this.companyToDelete.set(null);
        this.fetchCompanies();
      },
      error: (err) => {
        this.isDeleting.set(false);
        console.error('Delete failed:', err);
        this.feedback.set({
          type: 'error',
          title: 'Delete Failed',
          message: 'Could not delete the company record. Please verify server connection.'
        });
      }
    });
  }

  // --- Form Reset & Navigation ---
  resetForm(): void {
    this.companyForm.reset({
      companyName: '',
      email: '',
      landline: '',
      address: '',
      city: '',
      country: 'United States',
      website: '',
      description: '',
      status: 'ACTIVE',
      contactName: '',
      contactDesignation: '',
      contactEmail: '',
      contactMobileNumber: ''
    });
    this.selectedBrandIds.set([]);
    this.manuallySelectedBrandIds.set(new Set());
    this.selectedProductIds.set([]);
    this.brandSearchQuery.set('');
    this.productSearchQuery.set('');
    this.activeProductBrandFilter.set('all');
    this.activeProductCategoryFilter.set('all');
    this.activeProductSubCategoryFilter.set('all');
    this.removeFile();
  }

  closeFeedback(): void {
    this.feedback.set(null);
  }

  // --- View Detail Modal ---
  openCompanyDetail(comp: CompanyResponse): void {
    this.selectedCompany.set(comp);
  }

  closeCompanyDetail(): void {
    this.selectedCompany.set(null);
  }

  // Filtered companies based on search
  get filteredCompanies(): CompanyResponse[] {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.companies();
    return this.companies().filter(c =>
      c.companyName?.toLowerCase().includes(query) ||
      c.contactName?.toLowerCase().includes(query) ||
      c.contactEmail?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.city?.toLowerCase().includes(query) ||
      c.country?.toLowerCase().includes(query) ||
      c.brands?.some(b => b.brandName?.toLowerCase().includes(query)) ||
      c.products?.some(p => p.name?.toLowerCase().includes(query))
    );
  }

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
    // Timeout gives user enough time to click on suggestion items
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
      country: company.country || 'United States',
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
    this.manuallySelectedBrandIds.set(new Set(brandIds));

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

  // Helpers for validation styling
  isInvalid(controlName: string): boolean {
    const control = this.companyForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  // ==========================================
  // SHARE SYSTEM HANDLERS
  // ==========================================
  openShareModal(company: CompanyResponse, event?: Event): void {
    if (event) event.stopPropagation();
    this.companyToShare.set(company);
    this.isCopied.set(false);
  }

  closeShareModal(): void {
    this.companyToShare.set(null);
    this.isCopied.set(false);
  }

  formatCompanyContactText(company: CompanyResponse): string {
    const lines: string[] = [];
    lines.push(`🏢 *${company.companyName.toUpperCase()}*`);
    if (company.contactName) {
      const desig = company.contactDesignation ? ` (${company.contactDesignation})` : '';
      lines.push(`👤 Contact: ${company.contactName}${desig}`);
    }
    if (company.contactMobileNumber) {
      lines.push(`📱 Mobile: ${company.contactMobileNumber}`);
    }
    if (company.landline) {
      lines.push(`☎️ Landline: ${company.landline}`);
    }
    if (company.email) {
      lines.push(`✉️ Email: ${company.email}`);
    }
    if (company.contactEmail && company.contactEmail !== company.email) {
      lines.push(`✉️ Direct Email: ${company.contactEmail}`);
    }
    if (company.address || company.city || company.country) {
      const loc = [company.address, company.city, company.country].filter(Boolean).join(', ');
      lines.push(`📍 Location: ${loc}`);
    }
    if (company.website) {
      lines.push(`🌐 Website: ${company.website}`);
    }
    if (company.brands && company.brands.length > 0) {
      const brandNames = company.brands.map(b => b.brandName).join(', ');
      lines.push(`🏷️ Brands Dealt: ${brandNames}`);
    }
    if (company.description) {
      lines.push(`📝 Overview: ${company.description}`);
    }
    return lines.join('\n');
  }

  async copyContactDetails(company: CompanyResponse): Promise<void> {
    const text = this.formatCompanyContactText(company);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2500);
    } catch (err) {
      console.error('Failed to copy contact details: ', err);
    }
  }

  shareViaWhatsApp(company: CompanyResponse): void {
    const text = this.formatCompanyContactText(company);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  shareViaEmail(company: CompanyResponse): void {
    const subject = encodeURIComponent(`Contact Details: ${company.companyName}`);
    const body = encodeURIComponent(this.formatCompanyContactText(company));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  downloadVCard(company: CompanyResponse): void {
    const contactName = company.contactName || company.companyName;
    const vCardLines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${contactName}`,
      `ORG:${company.companyName}`,
      company.contactDesignation ? `TITLE:${company.contactDesignation}` : '',
      company.contactMobileNumber ? `TEL;TYPE=CELL:${company.contactMobileNumber}` : '',
      company.landline ? `TEL;TYPE=WORK:${company.landline}` : '',
      company.contactEmail ? `EMAIL;TYPE=PREF,INTERNET:${company.contactEmail}` : '',
      company.email ? `EMAIL;TYPE=WORK,INTERNET:${company.email}` : '',
      (company.address || company.city || company.country)
        ? `ADR;TYPE=WORK:;;${company.address || ''};${company.city || ''};;;${company.country || ''}`
        : '',
      company.website ? `URL:${company.website}` : '',
      company.description ? `NOTE:${company.description.replace(/\r?\n/g, ' ')}` : '',
      'END:VCARD'
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([vCardLines], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = company.companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
    link.href = url;
    link.setAttribute('download', `${safeName}_contact.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async shareNative(company: CompanyResponse): Promise<void> {
    if (this.canNativeShare()) {
      try {
        await navigator.share({
          title: `${company.companyName} Contact Details`,
          text: this.formatCompanyContactText(company)
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          await this.copyContactDetails(company);
        }
      }
    } else {
      await this.copyContactDetails(company);
    }
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
    this.isOcrModalOpen.set(true);
    this.ocrApiKeyInput.set(this.ocrService.getApiKey());
  }

  closeOcrModal(): void {
    if (this.isScanningCard()) return;
    this.isOcrModalOpen.set(false);
  }

  resetOcrScan(): void {
    this.scannedCardResult.set(null);
    this.scannedCardPreview.set(null);
    this.scannedCardFile.set(null);
    this.showRawOcrText.set(false);
  }

  onOcrFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processCardOcr(input.files[0]);
      input.value = '';
    }
  }

  onOcrDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.ocrDragOver.set(false);
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.processCardOcr(event.dataTransfer.files[0]);
    }
  }

  onOcrDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.ocrDragOver.set(true);
  }

  onOcrDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.ocrDragOver.set(false);
  }

  processCardOcr(file: File): void {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.feedback.set({
        type: 'error',
        title: 'Unsupported Image Format',
        message: 'Please upload a JPG, PNG, or WEBP image of the business card for OCR processing.'
      });
      return;
    }

    this.scannedCardFile.set(file);
    this.isScanningCard.set(true);
    this.isOcrModalOpen.set(true);

    // Read and create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      this.scannedCardPreview.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    this.ocrService.scanBusinessCard(file).subscribe({
      next: (result) => {
        this.scannedCardResult.set(result);
        this.isScanningCard.set(false);
      },
      error: (err) => {
        console.error('OCR scanning error:', err);
        this.isScanningCard.set(false);
        this.feedback.set({
          type: 'error',
          title: 'Scanning Error',
          message: err?.message || 'Could not extract text from the business card. Please try a clearer picture.'
        });
      }
    });
  }

  scanExistingCard(item: BusinessCardItem, event?: Event): void {
    if (event) event.stopPropagation();
    if (item.file) {
      this.processCardOcr(item.file);
    } else if (item.url) {
      fetch(item.url)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], item.name, { type: blob.type || 'image/jpeg' });
          this.processCardOcr(file);
        })
        .catch(err => {
          console.error('Failed to load card for OCR:', err);
          this.feedback.set({
            type: 'error',
            title: 'Image Load Error',
            message: 'Unable to access the visiting card image for scanning.'
          });
        });
    }
  }

  applyOcrResult(): void {
    const res = this.scannedCardResult();
    if (!res) return;

    // Apply values to reactive form
    const currentValues = this.companyForm.value;
    this.companyForm.patchValue({
      companyName: res.companyName || currentValues.companyName,
      contactName: res.contactName || currentValues.contactName,
      contactDesignation: res.contactDesignation || currentValues.contactDesignation,
      email: res.email || currentValues.email,
      contactEmail: res.contactEmail || res.email || currentValues.contactEmail,
      contactMobileNumber: res.contactMobileNumber || currentValues.contactMobileNumber,
      landline: res.landline || currentValues.landline,
      website: res.website || currentValues.website,
      address: res.address || currentValues.address,
      city: res.city || currentValues.city,
      country: res.country || currentValues.country || 'United States'
    });

    // Automatically attach the card file to Section 07 if selected
    const file = this.scannedCardFile();
    if (this.autoAttachScannedCard() && file) {
      const alreadyAdded = this.businessCardItems().some(c => c.name === file.name && c.size === file.size);
      if (!alreadyAdded) {
        this.handleFiles([file]);
      }
    }

    this.isOcrModalOpen.set(false);
    this.feedback.set({
      type: 'success',
      title: 'Business Card Details Applied! 🎉',
      message: `Extracted company "${res.companyName || 'Detected'}", contact "${res.contactName || 'Detected'}" and related details have auto-filled into the form.`
    });
  }

  toggleOcrSettings(): void {
    this.isOcrSettingsOpen.update(v => !v);
  }

  saveOcrApiKey(): void {
    const key = this.ocrApiKeyInput().trim();
    this.ocrService.setApiKey(key);
    this.isOcrSettingsOpen.set(false);
    this.feedback.set({
      type: 'success',
      title: 'Vision API Key Updated',
      message: key ? 'Google Cloud Vision API key saved locally in browser.' : 'Custom API key removed. Using default simulation.'
    });
  }

  clearOcrApiKey(): void {
    this.ocrApiKeyInput.set('');
    this.ocrService.setApiKey('');
    this.isOcrSettingsOpen.set(false);
    this.feedback.set({
      type: 'success',
      title: 'Vision API Key Cleared',
      message: 'Reverted to intelligent fallback mode.'
    });
  }
}

