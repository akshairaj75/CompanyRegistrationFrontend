import { Component, input, model, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BrandResponse } from '../../../../core/models/brand.model';
import { ProductResponse, ScrapedProduct, ScrapeProductsResponse } from '../../../../core/models/product.model';
import { CategoryResponse } from '../../../../core/models/category.model';
import { BrandService } from '../../../../core/services/brand';
import { ProductService } from '../../../../core/services/product';
import { CompanyService } from '../../../../core/services/company';
import { getHumanReadableHttpError } from '../../../../core/utils/company-form.util';
import { CustomSelectComponent } from '../../../../core/components/custom-select/custom-select.component';
import { CustomSelectOption } from '../../../../core/components/custom-select/custom-select.model';

@Component({
  selector: 'app-company-catalog-picker',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, CustomSelectComponent],
  templateUrl: './company-catalog-picker.component.html',
  styleUrl: './company-catalog-picker.component.css'
})
export class CompanyCatalogPickerComponent {
  readonly brandService = inject(BrandService);
  readonly productService = inject(ProductService);
  readonly companyService = inject(CompanyService);

  // Inputs & Two-Way Models
  readonly availableBrands = input<BrandResponse[]>([]);
  readonly availableProducts = input<ProductResponse[]>([]);
  readonly availableCategories = input<CategoryResponse[]>([]);
  readonly isLoadingBrands = input<boolean>(false);
  readonly isLoadingProducts = input<boolean>(false);
  readonly isLoadingCategories = input<boolean>(false);
  readonly websiteUrl = input<string>('');

  readonly selectedBrandIds = model<number[]>([]);
  readonly selectedProductIds = model<number[]>([]);

  readonly feedbackMessage = output<{ type: 'success' | 'error'; title: string; message: string }>();

  // Internal State
  readonly manuallySelectedBrandIds = signal<Set<number>>(new Set<number>());
  readonly brandSearchQuery = signal<string>('');
  readonly productSearchQuery = signal<string>('');
  readonly activeProductBrandFilter = signal<string>('all');
  readonly activeProductCategoryFilter = signal<string>('all');
  readonly activeProductSubCategoryFilter = signal<string>('all');

  // Website Product Scraping State
  readonly isScrapingWebsite = signal<boolean>(false);
  readonly scrapedProducts = signal<ScrapedProduct[]>([]);
  readonly scrapedWebsiteUrl = signal<string>('');
  readonly scrapedStrategyUsed = signal<string>('');
  readonly selectedScrapedIndices = signal<Set<number>>(new Set<number>());
  readonly isScrapedDrawerOpen = signal<boolean>(false);

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

  // Custom Select Option Lists
  readonly brandFilterOptions = computed<CustomSelectOption[]>(() => [
    { value: 'all', label: `Filter by Brand: All (${this.availableProducts().length})` },
    ...this.brandsWithProducts().map(b => ({
      value: String(b.id),
      label: b.brandName,
      badge: `${b.productCount} prods`
    }))
  ]);

  readonly categoryFilterOptions = computed<CustomSelectOption[]>(() => [
    { value: 'all', label: 'Filter by Category: All' },
    ...this.availableCategoriesForBrand().map(c => ({
      value: String(c.id),
      label: c.name
    }))
  ]);

  readonly subCategoryFilterOptions = computed<CustomSelectOption[]>(() => [
    { value: 'all', label: 'Filter by Subcategory: All' },
    ...this.availableSubCategoriesForSelection().map(s => ({
      value: String(s.id),
      label: s.name
    }))
  ]);

  // Filtered Products for selection
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

  readonly filteredAvailableBrands = computed(() => {
    const query = this.brandSearchQuery().toLowerCase().trim();
    if (!query) return this.availableBrands();
    return this.availableBrands().filter(b => b.brandName?.toLowerCase().includes(query));
  });

  readonly selectedBrandsList = computed(() => {
    const ids = new Set(this.selectedBrandIds());
    return this.availableBrands().filter(b => ids.has(b.id));
  });

  readonly selectedProductsList = computed(() => {
    const ids = new Set(this.selectedProductIds());
    return this.availableProducts().filter(p => ids.has(p.id));
  });

  // --- Brand Selection Handlers ---
  toggleBrand(brandId: number): void {
    const current = this.selectedBrandIds();
    if (current.includes(brandId)) {
      this.selectedBrandIds.set(current.filter(id => id !== brandId));
      this.manuallySelectedBrandIds.update(set => {
        const next = new Set(set);
        next.delete(brandId);
        return next;
      });
      // Cascade: automatically unselect all products belonging to this brand
      const productsOfThisBrand = new Set(
        this.availableProducts().filter(p => p.brandId === brandId).map(p => p.id)
      );
      this.selectedProductIds.set(
        this.selectedProductIds().filter(id => !productsOfThisBrand.has(id))
      );
    } else {
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
    this.selectedProductIds.set([]);
  }

  // --- Product Selection Handlers ---
  toggleProduct(product: ProductResponse): void {
    const current = this.selectedProductIds();
    if (current.includes(product.id)) {
      this.removeProductAndCheckBrand(product.id, product.brandId);
    } else {
      this.selectedProductIds.set([...current, product.id]);
      if (product.brandId && !this.selectedBrandIds().includes(product.brandId)) {
        this.selectedBrandIds.set([...this.selectedBrandIds(), product.brandId]);
      }
    }
  }

  removeProductAndCheckBrand(productId: number, brandId?: number): void {
    const updatedProdIds = this.selectedProductIds().filter(id => id !== productId);
    this.selectedProductIds.set(updatedProdIds);

    const bId = brandId || this.availableProducts().find(p => p.id === productId)?.brandId;
    if (bId) {
      const hasOtherProductsOfBrand = this.availableProducts().some(
        p => p.brandId === bId && updatedProdIds.includes(p.id)
      );
      if (!hasOtherProductsOfBrand && !this.manuallySelectedBrandIds().has(bId)) {
        this.selectedBrandIds.set(this.selectedBrandIds().filter(id => id !== bId));
      }
    }
  }

  removeSelectedProduct(productId: number): void {
    this.removeProductAndCheckBrand(productId);
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

    const remainingProds = this.availableProducts().filter(p => remainingProdIds.includes(p.id));
    const activeBrandIdsFromProds = new Set(remainingProds.map(p => p.brandId).filter(Boolean));

    this.selectedBrandIds.set(
      this.selectedBrandIds().filter(bId =>
        this.manuallySelectedBrandIds().has(bId) || activeBrandIdsFromProds.has(bId)
      )
    );
  }

  clearSelectedProducts(): void {
    const remainingBrandIds = this.selectedBrandIds().filter(bId =>
      this.manuallySelectedBrandIds().has(bId)
    );
    this.selectedProductIds.set([]);
    this.selectedBrandIds.set(remainingBrandIds);
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

  // --- Website Product Scraping Methods ---
  scrapeWebsite(url?: string): void {
    const site = (url || this.websiteUrl())?.trim();
    if (!site) {
      this.feedbackMessage.emit({
        type: 'error',
        title: 'Website Required',
        message: 'Please provide a valid official website URL before discovering products.'
      });
      return;
    }

    this.isScrapingWebsite.set(true);
    this.isScrapedDrawerOpen.set(true);

    this.companyService.scrapeProductsFromWebsite(site).subscribe({
      next: (res: ScrapeProductsResponse) => {
        this.isScrapingWebsite.set(false);
        this.scrapedProducts.set(res.products || []);
        this.scrapedWebsiteUrl.set(res.scannedUrl || site);
        this.scrapedStrategyUsed.set(res.strategyUsed || 'Website Crawler');

        const preselectedIndices = new Set<number>();
        (res.products || []).forEach((p, idx) => {
          if (p.matchedCatalogProductId) {
            preselectedIndices.add(idx);
            const currentIds = this.selectedProductIds();
            if (!currentIds.includes(p.matchedCatalogProductId)) {
              const matchedCatalogProd = this.availableProducts().find(ap => ap.id === p.matchedCatalogProductId);
              if (matchedCatalogProd) {
                this.toggleProduct(matchedCatalogProd);
              }
            }
          }
        });
        this.selectedScrapedIndices.set(preselectedIndices);

        if (res.products && res.products.length > 0) {
          this.feedbackMessage.emit({
            type: 'success',
            title: 'Products Discovered!',
            message: `Found ${res.products.length} product(s) from ${site} via ${res.strategyUsed}. Select the ones you want to link.`
          });
          setTimeout(() => {
            const el = document.getElementById('scrapedProductsDrawer');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 150);
        } else {
          this.feedbackMessage.emit({
            type: 'error',
            title: 'No Products Detected',
            message: res.message || 'We could not detect standard eCommerce products on this website. You can manually choose products below.'
          });
        }
      },
      error: (err) => {
        this.isScrapingWebsite.set(false);
        console.error('Error scraping products:', err);
        this.feedbackMessage.emit({
          type: 'error',
          title: 'Website Scan Failed',
          message: getHumanReadableHttpError(err, 'Could not fetch or scan the website. Please ensure the domain is publicly accessible.')
        });
      }
    });
  }

  toggleScrapedProduct(index: number): void {
    const current = new Set(this.selectedScrapedIndices());
    const product = this.scrapedProducts()[index];
    if (!product) return;

    if (current.has(index)) {
      current.delete(index);
      if (product.matchedCatalogProductId) {
        this.removeProductAndCheckBrand(product.matchedCatalogProductId);
      }
    } else {
      current.add(index);
      if (product.matchedCatalogProductId) {
        const catalogProd = this.availableProducts().find(p => p.id === product.matchedCatalogProductId);
        if (catalogProd && !this.selectedProductIds().includes(product.matchedCatalogProductId)) {
          this.toggleProduct(catalogProd);
        }
      }
    }
    this.selectedScrapedIndices.set(current);
  }

  selectAllScrapedProducts(): void {
    const all = new Set<number>();
    this.scrapedProducts().forEach((p, idx) => {
      all.add(idx);
      if (p.matchedCatalogProductId) {
        const catalogProd = this.availableProducts().find(cp => cp.id === p.matchedCatalogProductId);
        if (catalogProd && !this.selectedProductIds().includes(p.matchedCatalogProductId)) {
          this.toggleProduct(catalogProd);
        }
      }
    });
    this.selectedScrapedIndices.set(all);
  }

  deselectAllScrapedProducts(): void {
    const current = this.selectedScrapedIndices();
    this.scrapedProducts().forEach((p, idx) => {
      if (current.has(idx) && p.matchedCatalogProductId) {
        this.removeProductAndCheckBrand(p.matchedCatalogProductId);
      }
    });
    this.selectedScrapedIndices.set(new Set());
  }

  openScrapedDrawerWithScroll(): void {
    this.isScrapedDrawerOpen.set(true);
    setTimeout(() => {
      const el = document.getElementById('scrapedProductsDrawer');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  closeScrapedDrawer(): void {
    this.isScrapedDrawerOpen.set(false);
  }
}
