import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CompanyService } from '../../core/services/company';
import { BrandService } from '../../core/services/brand';
import { CompanyRequest, CompanyResponse } from '../../core/models/company.model';
import { BrandResponse } from '../../core/models/brand.model';
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
  readonly environment = environment;

  // State Signals
  readonly isSubmitting = signal<boolean>(false);
  readonly isLoadingList = signal<boolean>(false);
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
  readonly isLoadingBrands = signal<boolean>(false);
  readonly brandSearchQuery = signal<string>('');

  // Selected Company for View Modal
  readonly selectedCompany = signal<CompanyResponse | null>(null);

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

  // --- Brand Selection Handlers ---
  toggleBrand(brandId: number): void {
    const current = this.selectedBrandIds();
    if (current.includes(brandId)) {
      this.selectedBrandIds.set(current.filter(id => id !== brandId));
    } else {
      this.selectedBrandIds.set([...current, brandId]);
    }
  }

  isBrandSelected(brandId: number): boolean {
    return this.selectedBrandIds().includes(brandId);
  }

  selectAllBrands(): void {
    this.selectedBrandIds.set(this.availableBrands().map(b => b.id));
  }

  clearSelectedBrands(): void {
    this.selectedBrandIds.set([]);
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
      brandIds: this.selectedBrandIds()
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
    this.brandSearchQuery.set('');
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
      c.brands?.some(b => b.brandName?.toLowerCase().includes(query))
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
