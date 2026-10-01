import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product';
import { CategoryService } from '../../core/services/category';
import { BrandService } from '../../core/services/brand';
import { ProductRequest, ProductResponse } from '../../core/models/product.model';
import { CategoryResponse } from '../../core/models/category.model';
import { BrandResponse } from '../../core/models/brand.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-product-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './product-register.component.html',
  styleUrl: './product-register.component.css'
})
export class ProductRegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly productService = inject(ProductService);
  readonly categoryService = inject(CategoryService);
  readonly brandService = inject(BrandService);
  readonly environment = environment;

  // State Signals
  readonly isSubmitting = signal<boolean>(false);
  readonly isLoadingList = signal<boolean>(false);
  readonly activeTab = signal<'register' | 'directory'>('register');
  readonly feedback = signal<{ type: 'success' | 'error'; title: string; message: string } | null>(null);

  // Edit State
  readonly editingProductId = signal<number | null>(null);

  // Delete Confirmation State
  readonly productToDelete = signal<ProductResponse | null>(null);
  readonly isDeleting = signal<boolean>(false);

  // File Upload State
  readonly selectedFile = signal<File | null>(null);
  readonly filePreviewUrl = signal<string | null>(null);
  readonly isDragOver = signal<boolean>(false);

  // Data Collections
  readonly products = signal<ProductResponse[]>([]);
  readonly categories = signal<CategoryResponse[]>([]);
  readonly brands = signal<BrandResponse[]>([]);

  // Hierarchy Data Computations
  readonly parentCategories = computed(() =>
    this.categories().filter(c => c.parentId == null)
  );

  readonly subCategories = computed(() => {
    const parents = this.parentCategories();
    return this.categories()
      .filter(c => c.parentId != null)
      .map(sub => ({
        ...sub,
        parentName: parents.find(p => p.id === sub.parentId)?.name || 'None'
      }));
  });

  // Track the categoryId selected in the form
  readonly selectedFormCategoryId = signal<string>('');

  // Available Subcategories based on the chosen category in the form
  readonly availableSubCategories = computed(() => {
    const catId = Number(this.selectedFormCategoryId());
    if (!catId) return [];
    return this.subCategories().filter(s => s.parentId === catId);
  });

  // Filtering & Search
  readonly searchQuery = signal<string>('');
  readonly filterCategory = signal<string>('all');
  readonly filterSubCategory = signal<string>('all');
  readonly filterBrand = signal<string>('all');
  readonly filterFeatured = signal<'all' | 'featured' | 'standard'>('all');

  // Subcategories available in directory filter based on filterCategory
  readonly filterSubCategoriesList = computed(() => {
    const catFilter = this.filterCategory();
    if (!catFilter || catFilter === 'all') {
      return this.subCategories();
    }
    const catId = Number(catFilter);
    return this.subCategories().filter(s => s.parentId === catId);
  });

  // Selected Product for View Modal
  readonly selectedProduct = signal<ProductResponse | null>(null);

  // Reactive Form Definition
  productForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    categoryId: ['', [Validators.required]],
    subCategoryId: [''],
    brandId: ['', [Validators.required]],
    description: ['', [Validators.maxLength(2000)]],
    isFeatured: [false]
  });

  ngOnInit(): void {
    this.fetchCategories();
    this.fetchBrands();
    this.fetchProducts();

    this.productForm.get('categoryId')?.valueChanges.subscribe((val) => {
      this.selectedFormCategoryId.set(val ? val.toString() : '');
      const currentSub = this.productForm.get('subCategoryId')?.value;
      if (currentSub) {
        const validSub = this.availableSubCategories().some(s => s.id === Number(currentSub));
        if (!validSub) {
          this.productForm.patchValue({ subCategoryId: '' }, { emitEvent: false });
        }
      }
    });
  }

  fetchCategories(): void {
    this.categoryService.getAllCategories().subscribe({
      next: (data) => this.categories.set(data || []),
      error: (err) => console.error('Failed to load categories:', err)
    });
  }

  fetchBrands(): void {
    this.brandService.getAllBrands().subscribe({
      next: (data) => this.brands.set(data || []),
      error: (err) => console.error('Failed to load brands:', err)
    });
  }

  fetchProducts(): void {
    this.isLoadingList.set(true);
    this.productService.getAllProducts().subscribe({
      next: (data) => {
        this.products.set(data || []);
        this.isLoadingList.set(false);
      },
      error: (err) => {
        console.error('Failed to load products:', err);
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
        message: 'Max product image size allowed is 20MB.'
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
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      this.feedback.set({
        type: 'error',
        title: 'Validation Error',
        message: 'Please fill in all required fields (Product Name, Category, and Brand).'
      });
      return;
    }

    this.isSubmitting.set(true);
    this.feedback.set(null);

    const formValues = this.productForm.value;
    const requestData: ProductRequest = {
      name: formValues.name.trim(),
      categoryId: Number(formValues.categoryId),
      subCategoryId: formValues.subCategoryId ? Number(formValues.subCategoryId) : null,
      brandId: Number(formValues.brandId),
      description: formValues.description ? formValues.description.trim() : undefined,
      isFeatured: !!formValues.isFeatured,
      featured: !!formValues.isFeatured
    };

    const fileToUpload = this.selectedFile();
    const editId = this.editingProductId();

    if (editId) {
      this.productService.updateProduct(editId, requestData, fileToUpload).subscribe({
        next: (response) => {
          this.isSubmitting.set(false);
          this.feedback.set({
            type: 'success',
            title: 'Product Updated Successfully!',
            message: `Product "${response.name}" (ID #${response.id}) has been updated.`
          });
          this.editingProductId.set(null);
          this.resetForm();
          this.fetchProducts();
          this.activeTab.set('directory');
        },
        error: (err) => {
          this.isSubmitting.set(false);
          console.error('Product update failed:', err);
          const errMsg = err?.error?.message || err?.message || 'Server error occurred during product update.';
          this.feedback.set({
            type: 'error',
            title: 'Update Failed',
            message: errMsg
          });
        }
      });
    } else {
      this.productService.createProduct(requestData, fileToUpload).subscribe({
        next: (response) => {
          this.isSubmitting.set(false);
          this.feedback.set({
            type: 'success',
            title: 'Product Registered Successfully!',
            message: `Product "${response.name}" has been registered with ID #${response.id}.`
          });
          this.resetForm();
          this.fetchProducts();
          this.activeTab.set('directory');
        },
        error: (err) => {
          this.isSubmitting.set(false);
          console.error('Product registration failed:', err);
          const errMsg = err?.error?.message || err?.message || 'Server error occurred during product creation.';
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
  startEdit(product: ProductResponse, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingProductId.set(product.id);

    this.selectedFormCategoryId.set(product.categoryId ? product.categoryId.toString() : '');
    this.productForm.patchValue({
      name: product.name || '',
      categoryId: product.categoryId || '',
      subCategoryId: product.subCategoryId || '',
      brandId: product.brandId || '',
      description: product.description || '',
      isFeatured: !!(product.isFeatured ?? product.featured)
    });

    this.selectedFile.set(null);
    if (product.image) {
      this.filePreviewUrl.set(this.productService.getFileUrl(product.image));
    } else {
      this.filePreviewUrl.set(null);
    }

    if (this.selectedProduct()) {
      this.closeProductDetail();
    }

    this.activeTab.set('register');
  }

  cancelEdit(): void {
    this.editingProductId.set(null);
    this.resetForm();
  }

  switchToRegister(): void {
    this.cancelEdit();
    this.activeTab.set('register');
  }

  // --- Delete Actions ---
  promptDelete(product: ProductResponse, event?: Event): void {
    if (event) event.stopPropagation();
    this.productToDelete.set(product);
  }

  cancelDelete(): void {
    this.productToDelete.set(null);
  }

  confirmDelete(): void {
    const toDelete = this.productToDelete();
    if (!toDelete) return;

    this.isDeleting.set(true);
    this.productService.deleteProduct(toDelete.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.feedback.set({
          type: 'success',
          title: 'Product Deleted',
          message: `Product "${toDelete.name}" has been permanently deleted.`
        });
        if (this.selectedProduct()?.id === toDelete.id) {
          this.closeProductDetail();
        }
        if (this.editingProductId() === toDelete.id) {
          this.cancelEdit();
        }
        this.productToDelete.set(null);
        this.fetchProducts();
      },
      error: (err) => {
        this.isDeleting.set(false);
        console.error('Product delete failed:', err);
        this.feedback.set({
          type: 'error',
          title: 'Delete Failed',
          message: 'Could not delete product record. Please verify server connection.'
        });
      }
    });
  }

  // --- Helper Methods ---
  resetForm(): void {
    this.productForm.reset({
      name: '',
      categoryId: '',
      subCategoryId: '',
      brandId: '',
      description: '',
      isFeatured: false
    });
    this.selectedFormCategoryId.set('');
    this.removeFile();
  }

  closeFeedback(): void {
    this.feedback.set(null);
  }

  openProductDetail(p: ProductResponse): void {
    this.selectedProduct.set(p);
  }

  closeProductDetail(): void {
    this.selectedProduct.set(null);
  }

  getCategoryName(id?: number): string {
    if (!id) return '';
    const cat = this.categories().find(c => c.id === id);
    return cat ? cat.name : `Category #${id}`;
  }

  getSubCategoryName(id?: number | null): string {
    if (!id) return '';
    const sub = this.subCategories().find(s => s.id === id);
    return sub ? sub.name : `Subcategory #${id}`;
  }

  getBrandName(id?: number): string {
    if (!id) return '';
    const brand = this.brands().find(b => b.id === id);
    return brand ? brand.brandName : `Brand #${id}`;
  }

  // Filtered Products
  get filteredProducts(): ProductResponse[] {
    const query = this.searchQuery().toLowerCase().trim();
    const catFilter = this.filterCategory();
    const subCatFilter = this.filterSubCategory();
    const brandFilter = this.filterBrand();
    const featFilter = this.filterFeatured();

    return this.products().filter(p => {
      // Query match (name, description, brandName, categoryName, subCategoryName, or ID)
      const matchesQuery = !query ||
        p.name?.toLowerCase().includes(query) ||
        p.id?.toString().includes(query) ||
        p.brandName?.toLowerCase().includes(query) ||
        p.categoryName?.toLowerCase().includes(query) ||
        p.subCategoryName?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query);

      if (!matchesQuery) return false;

      // Category filter (Main Category)
      if (catFilter !== 'all' && p.categoryId?.toString() !== catFilter) {
        return false;
      }

      // Subcategory filter
      if (subCatFilter !== 'all' && p.subCategoryId?.toString() !== subCatFilter) {
        return false;
      }

      // Brand filter
      if (brandFilter !== 'all' && p.brandId?.toString() !== brandFilter) {
        return false;
      }

      // Featured filter
      const isFeat = !!(p.isFeatured ?? p.featured);
      if (featFilter === 'featured') return isFeat;
      if (featFilter === 'standard') return !isFeat;

      return true;
    });
  }

  isInvalid(controlName: string): boolean {
    const control = this.productForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
