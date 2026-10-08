import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CategoryService } from '../../core/services/category';
import { CategoryRequest, CategoryResponse } from '../../core/models/category.model';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-category-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './category-register.component.html',
  styleUrl: './category-register.component.css'
})
export class CategoryRegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly categoryService = inject(CategoryService);
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
  readonly editingCategoryId = signal<number | null>(null);

  // Delete Confirmation State
  readonly categoryToDelete = signal<CategoryResponse | null>(null);
  readonly isDeleting = signal<boolean>(false);

  // File Upload State
  readonly selectedFile = signal<File | null>(null);
  readonly filePreviewUrl = signal<string | null>(null);
  readonly isDragOver = signal<boolean>(false);

  // Flat Categories Array from Backend
  readonly categories = signal<CategoryResponse[]>([]);
  readonly searchQuery = signal<string>('');

  // 1) parentCategories = categories.filter(c => c.parentId == null)
  readonly parentCategories = computed(() =>
    this.categories().filter(c => c.parentId == null)
  );

  // 2) subCategories = categories.filter(c => c.parentId != null) enriched with parent's name
  readonly subCategories = computed(() => {
    const parents = this.parentCategories();
    return this.categories()
      .filter(c => c.parentId != null)
      .map(sub => ({
        ...sub,
        parentName: parents.find(p => p.id === sub.parentId)?.name || 'None'
      }));
  });

  // UI Display & Filtering: Toggle between 'main' (Main Categories) and 'sub' (Subcategories)
  readonly categoryViewTab = signal<'main' | 'sub'>('main');

  // Subcategories view parent filter: 'all' or specific parent id
  readonly selectedParentFilter = signal<string>('all');

  // Available parents for the Create/Edit dropdown (excludes current category being edited)
  readonly availableParents = computed(() => {
    const editId = this.editingCategoryId();
    if (!editId) return this.parentCategories();
    return this.parentCategories().filter(p => p.id !== editId);
  });

  // Filtered Main Categories for Directory
  readonly filteredParentCategories = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.parentCategories();
    return this.parentCategories().filter(c =>
      c.name?.toLowerCase().includes(query) ||
      c.id?.toString().includes(query)
    );
  });

  // Filtered Subcategories for Directory
  readonly filteredSubCategories = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const parentFilter = this.selectedParentFilter();

    return this.subCategories().filter(sub => {
      if (parentFilter !== 'all' && sub.parentId?.toString() !== parentFilter) {
        return false;
      }
      if (query) {
        const matchesName = sub.name?.toLowerCase().includes(query);
        const matchesParent = sub.parentName?.toLowerCase().includes(query);
        const matchesId = sub.id?.toString().includes(query);
        if (!matchesName && !matchesParent && !matchesId) return false;
      }
      return true;
    });
  });

  // Selected Category for View Modal
  readonly selectedCategory = signal<CategoryResponse | null>(null);

  // Form Definition with parentId
  categoryForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    parentId: ['']
  });

  ngOnInit(): void {
    this.fetchCategories();
  }

  fetchCategories(): void {
    this.isLoadingList.set(true);
    this.categoryService.getCategories().subscribe({
      next: (data) => {
        this.categories.set(data || []);
        this.isLoadingList.set(false);
      },
      error: (err) => {
        console.error('Failed to load categories:', err);
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
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const maxSizeBytes = 20 * 1024 * 1024; // 20 MB

    if (!allowedTypes.includes(file.type)) {
      this.feedback.set({
        type: 'error',
        title: 'Unsupported Image Format',
        message: 'Please upload a JPEG, PNG, WEBP, or GIF image.'
      });
      return;
    }

    if (file.size > maxSizeBytes) {
      this.feedback.set({
        type: 'error',
        title: 'File Too Large',
        message: 'Max image file size allowed is 20MB.'
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
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      this.feedback.set({
        type: 'error',
        title: 'Validation Error',
        message: 'Please provide a valid category name (min 2 characters).'
      });
      return;
    }

    this.isSubmitting.set(true);
    this.feedback.set(null);

    const formValues = this.categoryForm.value;
    const parentId = formValues.parentId ? Number(formValues.parentId) : null;
    const requestData: CategoryRequest = {
      name: formValues.name.trim(),
      parentId: parentId
    };

    const fileToUpload = this.selectedFile();
    const editId = this.editingCategoryId();

    if (editId) {
      this.categoryService.updateCategory(editId, requestData, fileToUpload).subscribe({
        next: (response) => {
          this.isSubmitting.set(false);
          this.feedback.set({
            type: 'success',
            title: 'Category Updated Successfully!',
            message: `Category "${response.name}" (ID #${response.id}) has been updated.`
          });
          this.editingCategoryId.set(null);
          this.resetForm();
          this.fetchCategories();
          this.activeTab.set('directory');
        },
        error: (err) => {
          this.isSubmitting.set(false);
          console.error('Update failed:', err);
          const errMsg = err?.error?.message || err?.message || 'Server error occurred during category update.';
          this.feedback.set({
            type: 'error',
            title: 'Update Failed',
            message: errMsg
          });
        }
      });
    } else {
      this.categoryService.createCategory(requestData, fileToUpload).subscribe({
        next: (response) => {
          this.isSubmitting.set(false);
          const isSub = response.parentId != null;
          this.feedback.set({
            type: 'success',
            title: isSub ? 'Subcategory Registered!' : 'Main Category Registered!',
            message: `Category "${response.name}" has been created with ID #${response.id}.`
          });
          this.resetForm();
          this.fetchCategories();
          this.activeTab.set('directory');
          if (isSub) {
            this.categoryViewTab.set('sub');
          }
        },
        error: (err) => {
          this.isSubmitting.set(false);
          console.error('Registration failed:', err);
          const errMsg = err?.error?.message || err?.message || 'Server error occurred during category creation.';
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
  startEdit(category: CategoryResponse, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingCategoryId.set(category.id);

    this.categoryForm.patchValue({
      name: category.name || '',
      parentId: category.parentId ? category.parentId : ''
    });

    this.selectedFile.set(null);
    if (category.categoryImage) {
      this.filePreviewUrl.set(this.categoryService.getFileUrl(category.categoryImage));
    } else {
      this.filePreviewUrl.set(null);
    }

    if (this.selectedCategory()) {
      this.closeCategoryDetail();
    }

    this.activeTab.set('register');
  }

  addSubCategoryForParent(parent: CategoryResponse, event?: Event): void {
    if (event) event.stopPropagation();
    this.cancelEdit();
    this.categoryForm.patchValue({
      name: '',
      parentId: parent.id
    });
    if (this.selectedCategory()) {
      this.closeCategoryDetail();
    }
    this.activeTab.set('register');
  }

  cancelEdit(): void {
    this.editingCategoryId.set(null);
    this.resetForm();
  }

  switchToRegister(): void {
    this.cancelEdit();
    this.activeTab.set('register');
  }

  // --- Delete Actions ---
  promptDelete(category: CategoryResponse, event?: Event): void {
    if (event) event.stopPropagation();
    this.categoryToDelete.set(category);
  }

  cancelDelete(): void {
    this.categoryToDelete.set(null);
  }

  confirmDelete(): void {
    const toDelete = this.categoryToDelete();
    if (!toDelete) return;

    this.isDeleting.set(true);
    this.categoryService.deleteCategory(toDelete.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.feedback.set({
          type: 'success',
          title: 'Category Deleted',
          message: `Category "${toDelete.name}" has been removed.`
        });
        if (this.selectedCategory()?.id === toDelete.id) {
          this.closeCategoryDetail();
        }
        if (this.editingCategoryId() === toDelete.id) {
          this.cancelEdit();
        }
        this.categoryToDelete.set(null);
        this.fetchCategories();
      },
      error: (err) => {
        this.isDeleting.set(false);
        console.error('Delete failed:', err);
        this.feedback.set({
          type: 'error',
          title: 'Delete Failed',
          message: 'Could not delete category record. Please verify server connection.'
        });
      }
    });
  }

  // --- Reset & View Handlers ---
  resetForm(): void {
    this.categoryForm.reset({
      name: '',
      parentId: ''
    });
    this.removeFile();
  }

  closeFeedback(): void {
    this.feedback.set(null);
  }

  openCategoryDetail(cat: CategoryResponse): void {
    this.selectedCategory.set(cat);
  }

  closeCategoryDetail(): void {
    this.selectedCategory.set(null);
  }

  getSubCount(parentId: number): number {
    return this.subCategories().filter(s => s.parentId === parentId).length;
  }

  getParentName(parentId?: number | null): string {
    if (!parentId) return 'None';
    const parent = this.parentCategories().find(p => p.id === parentId);
    return parent ? parent.name : 'None';
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  isInvalid(controlName: string): boolean {
    const control = this.categoryForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
