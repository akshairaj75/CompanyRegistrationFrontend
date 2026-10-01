import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CompanyService } from '../../core/services/company';
import { BrandService } from '../../core/services/brand';
import { ProductService } from '../../core/services/product';
import { CategoryService } from '../../core/services/category';
import { CompanyRequest, CompanyResponse } from '../../core/models/company.model';
import { BrandResponse } from '../../core/models/brand.model';
import { ProductResponse } from '../../core/models/product.model';
import { CategoryResponse } from '../../core/models/category.model';
import { environment } from '../../../environments/environment';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-company-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './company-register.component.html',
  styleUrl: './company-register.component.css'
})
export class CompanyRegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly companyService = inject(CompanyService);
  readonly brandService = inject(BrandService);
  readonly productService = inject(ProductService);
  readonly categoryService = inject(CategoryService);
  readonly environment = environment;

  // State Signals
  readonly isSubmitting = signal<boolean>(false);
  readonly isLoadingList = signal<boolean>(false);
  readonly isExportingExcel = signal<boolean>(false);
  readonly activeTab = signal<'register' | 'directory'>('register');
  readonly feedback = signal<{ type: 'success' | 'error'; title: string; message: string } | null>(null);

  // Edit State
  readonly editingCompanyId = signal<number | null>(null);

  // Delete Confirmation State
  readonly companyToDelete = signal<CompanyResponse | null>(null);
  readonly isDeleting = signal<boolean>(false);

  // File Upload State
  readonly selectedFile = signal<File | null>(null);
  readonly filePreviewUrl = signal<string | null>(null);
  readonly isPdfFile = signal<boolean>(false);
  readonly isDragOver = signal<boolean>(false);

  // Companies List State
  readonly companies = signal<CompanyResponse[]>([]);
  readonly searchQuery = signal<string>('');

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

  // --- File Drag & Drop & Selection Handlers ---
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
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  private handleFile(file: File): void {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    const maxSizeBytes = 20 * 1024 * 1024; // 20 MB

    if (!allowedTypes.includes(file.type)) {
      this.feedback.set({
        type: 'error',
        title: 'Unsupported File Format',
        message: 'Please upload a JPEG, PNG, WEBP, GIF, or PDF document.'
      });
      return;
    }

    if (file.size > maxSizeBytes) {
      this.feedback.set({
        type: 'error',
        title: 'File Too Large',
        message: 'Max file size allowed is 20MB.'
      });
      return;
    }

    this.selectedFile.set(file);
    const isPdf = file.type === 'application/pdf';
    this.isPdfFile.set(isPdf);

    if (isPdf) {
      this.filePreviewUrl.set(null);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.filePreviewUrl.set(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  removeFile(event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedFile.set(null);
    this.filePreviewUrl.set(null);
    this.isPdfFile.set(false);
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
      productIds: this.selectedProductIds()
    };

    const fileToUpload = this.selectedFile();
    const editId = this.editingCompanyId();

    if (editId) {
      // Update existing company
      this.companyService.updateCompany(editId, requestData, fileToUpload).subscribe({
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
      this.companyService.createCompany(requestData, fileToUpload).subscribe({
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

    this.selectedFile.set(null);
    if (company.businessCard) {
      if (company.businessCard.endsWith('.pdf')) {
        this.isPdfFile.set(true);
        this.filePreviewUrl.set(null);
      } else {
        this.isPdfFile.set(false);
        this.filePreviewUrl.set(this.companyService.getFileUrl(company.businessCard));
      }
    } else {
      this.isPdfFile.set(false);
      this.filePreviewUrl.set(null);
    }

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
  }

  // Helpers for validation styling
  isInvalid(controlName: string): boolean {
    const control = this.companyForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
