import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BrandService } from '../../core/services/brand';
import { BrandRequest, BrandResponse } from '../../core/models/brand.model';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-brand-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './brand-register.component.html',
  styleUrl: './brand-register.component.css'
})
export class BrandRegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly brandService = inject(BrandService);
  readonly authService = inject(AuthService);
  readonly environment = environment;

  readonly currentUser = this.authService.currentUser;

  logout(): void {
    this.authService.logout();
  }

  // State Signals
  readonly isSubmitting = signal<boolean>(false);
  readonly isLoadingList = signal<boolean>(false);
  readonly activeTab = signal<'register' | 'directory'>('register');
  readonly feedback = signal<{ type: 'success' | 'error'; title: string; message: string } | null>(null);

  // Edit State
  readonly editingBrandId = signal<number | null>(null);

  // Delete Confirmation State
  readonly brandToDelete = signal<BrandResponse | null>(null);
  readonly isDeleting = signal<boolean>(false);

  // File Upload State
  readonly selectedFile = signal<File | null>(null);
  readonly filePreviewUrl = signal<string | null>(null);
  readonly isDragOver = signal<boolean>(false);

  // Brands List & Filter State
  readonly brands = signal<BrandResponse[]>([]);
  readonly searchQuery = signal<string>('');
  readonly filterMode = signal<'all' | 'featured' | 'standard'>('all');

  // Selected Brand for View Modal
  readonly selectedBrand = signal<BrandResponse | null>(null);

  // Form Definition
  brandForm: FormGroup = this.fb.group({
    brandName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    isFeatured: [false]
  });

  ngOnInit(): void {
    this.fetchBrands();
  }

  fetchBrands(): void {
    this.isLoadingList.set(true);
    this.brandService.getAllBrands().subscribe({
      next: (data) => {
        this.brands.set(data || []);
        this.isLoadingList.set(false);
      },
      error: (err) => {
        console.error('Failed to load brands:', err);
        this.isLoadingList.set(false);
      }
    });
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
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    const maxSizeBytes = 20 * 1024 * 1024; // 20 MB

    if (!allowedTypes.includes(file.type)) {
      this.feedback.set({
        type: 'error',
        title: 'Unsupported Image Format',
        message: 'Please upload a JPEG, PNG, WEBP, GIF, or SVG image.'
      });
      return;
    }

    if (file.size > maxSizeBytes) {
      this.feedback.set({
        type: 'error',
        title: 'File Too Large',
        message: 'Max brand logo file size allowed is 20MB.'
      });
      return;
    }

    this.selectedFile.set(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      this.filePreviewUrl.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  removeFile(event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedFile.set(null);
    this.filePreviewUrl.set(null);
  }

  // --- Form Submission (Create or Update) ---
  onSubmit(): void {
    if (this.brandForm.invalid) {
      this.brandForm.markAllAsTouched();
      this.feedback.set({
        type: 'error',
        title: 'Validation Error',
        message: 'Please provide a valid brand name (min 2 characters).'
      });
      return;
    }

    this.isSubmitting.set(true);
    this.feedback.set(null);

    const formValues = this.brandForm.value;
    const requestData: BrandRequest = {
      brandName: formValues.brandName.trim(),
      isFeatured: !!formValues.isFeatured,
      featured: !!formValues.isFeatured
    };

    const fileToUpload = this.selectedFile();
    const editId = this.editingBrandId();

    if (editId) {
      this.brandService.updateBrand(editId, requestData, fileToUpload).subscribe({
        next: (response) => {
          this.isSubmitting.set(false);
          this.feedback.set({
            type: 'success',
            title: 'Brand Updated Successfully!',
            message: `Brand "${response.brandName}" (ID #${response.id}) has been updated.`
          });
          this.editingBrandId.set(null);
          this.resetForm();
          this.fetchBrands();
          this.activeTab.set('directory');
        },
        error: (err) => {
          this.isSubmitting.set(false);
          console.error('Brand update failed:', err);
          const errMsg = err?.error?.message || err?.message || 'Server error occurred during brand update.';
          this.feedback.set({
            type: 'error',
            title: 'Update Failed',
            message: errMsg
          });
        }
      });
    } else {
      this.brandService.createBrand(requestData, fileToUpload).subscribe({
        next: (response) => {
          this.isSubmitting.set(false);
          this.feedback.set({
            type: 'success',
            title: 'Brand Registered Successfully!',
            message: `Brand "${response.brandName}" has been created with ID #${response.id}.`
          });
          this.resetForm();
          this.fetchBrands();
          this.activeTab.set('directory');
        },
        error: (err) => {
          this.isSubmitting.set(false);
          console.error('Brand registration failed:', err);
          const errMsg = err?.error?.message || err?.message || 'Server error occurred during brand creation.';
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
  startEdit(brand: BrandResponse, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingBrandId.set(brand.id);

    this.brandForm.patchValue({
      brandName: brand.brandName || '',
      isFeatured: !!(brand.isFeatured ?? brand.featured)
    });

    this.selectedFile.set(null);
    if (brand.brandLogo) {
      this.filePreviewUrl.set(this.brandService.getFileUrl(brand.brandLogo));
    } else {
      this.filePreviewUrl.set(null);
    }

    if (this.selectedBrand()) {
      this.closeBrandDetail();
    }

    this.activeTab.set('register');
  }

  cancelEdit(): void {
    this.editingBrandId.set(null);
    this.resetForm();
  }

  switchToRegister(): void {
    this.cancelEdit();
    this.activeTab.set('register');
  }

  // --- Delete Actions ---
  promptDelete(brand: BrandResponse, event?: Event): void {
    if (event) event.stopPropagation();
    this.brandToDelete.set(brand);
  }

  cancelDelete(): void {
    this.brandToDelete.set(null);
  }

  confirmDelete(): void {
    const toDelete = this.brandToDelete();
    if (!toDelete) return;

    this.isDeleting.set(true);
    this.brandService.deleteBrand(toDelete.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.feedback.set({
          type: 'success',
          title: 'Brand Deleted',
          message: `Brand "${toDelete.brandName}" has been permanently removed.`
        });
        if (this.selectedBrand()?.id === toDelete.id) {
          this.closeBrandDetail();
        }
        if (this.editingBrandId() === toDelete.id) {
          this.cancelEdit();
        }
        this.brandToDelete.set(null);
        this.fetchBrands();
      },
      error: (err) => {
        this.isDeleting.set(false);
        console.error('Brand delete failed:', err);
        this.feedback.set({
          type: 'error',
          title: 'Delete Failed',
          message: 'Could not delete brand record. Please verify server connection.'
        });
      }
    });
  }

  // --- Reset & View Handlers ---
  resetForm(): void {
    this.brandForm.reset({
      brandName: '',
      isFeatured: false
    });
    this.removeFile();
  }

  closeFeedback(): void {
    this.feedback.set(null);
  }

  openBrandDetail(b: BrandResponse): void {
    this.selectedBrand.set(b);
  }

  closeBrandDetail(): void {
    this.selectedBrand.set(null);
  }

  // Filtered Brands
  get filteredBrands(): BrandResponse[] {
    const query = this.searchQuery().toLowerCase().trim();
    const mode = this.filterMode();

    return this.brands().filter(b => {
      const matchesQuery = !query ||
        b.brandName?.toLowerCase().includes(query) ||
        b.id?.toString().includes(query);

      if (!matchesQuery) return false;

      const isFeat = !!(b.isFeatured ?? b.featured);
      if (mode === 'featured') return isFeat;
      if (mode === 'standard') return !isFeat;
      return true;
    });
  }

  setFilterMode(mode: 'all' | 'featured' | 'standard'): void {
    this.filterMode.set(mode);
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  isInvalid(controlName: string): boolean {
    const control = this.brandForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  // Computed helper for initials
  getInitials(name?: string): string {
    if (!name) return 'B';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
}
