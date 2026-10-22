import { Component, input, output, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BrandResponse } from '../../../../core/models/brand.model';

@Component({
  selector: 'app-company-live-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './company-live-preview.component.html',
  styleUrl: './company-live-preview.component.css'
})
export class CompanyLivePreviewComponent implements OnInit, OnDestroy {
  readonly companyForm = input.required<FormGroup>();
  readonly selectedBrands = input<BrandResponse[]>([]);
  readonly selectedBrandCount = input<number>(0);
  readonly selectedProductCount = input<number>(0);
  readonly businessCardCount = input<number>(0);
  readonly filePreviewUrl = input<string | null>(null);
  readonly selectedCountryName = input<string>('');
  readonly editingCompanyId = input<number | null>(null);
  readonly isSubmitting = input<boolean>(false);

  readonly submitForm = output<void>();
  readonly cancelEdit = output<void>();
  readonly resetForm = output<void>();
  readonly shareCard = output<void>();

  readonly formValue = signal<any>({});
  private valueChangesSub?: Subscription;

  ngOnInit(): void {
    this.formValue.set(this.companyForm().value);
    this.valueChangesSub = this.companyForm().valueChanges.subscribe(val => {
      this.formValue.set(val);
    });
  }

  ngOnDestroy(): void {
    this.valueChangesSub?.unsubscribe();
  }

  readonly companyInitials = computed(() => {
    const name = this.formValue()?.companyName?.trim();
    if (!name) return '';
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  });

  readonly hasIdentityComplete = computed(() => {
    const val = this.formValue()?.companyName;
    return !!(val && val.trim().length >= 2);
  });

  readonly hasContactComplete = computed(() => {
    const email = this.formValue()?.email;
    const country = this.formValue()?.country;
    return !!(email && email.trim() && country && country.trim());
  });

  readonly hasBrandsComplete = computed(() => this.selectedBrandCount() > 0);
  readonly hasProductsComplete = computed(() => this.selectedProductCount() > 0);
  readonly hasAssetsComplete = computed(() => this.businessCardCount() > 0);

  readonly profileCompleteness = computed(() => {
    let score = 0;
    const form = this.formValue();
    const name = form?.companyName?.trim();
    const desc = form?.description?.trim();
    const email = form?.email?.trim();
    const country = form?.country?.trim();
    const city = form?.city?.trim();
    const address = form?.address?.trim();

    if (name && name.length >= 2) score += 20;
    if (desc) score += 10;
    if (email) score += 15;
    if (country) score += 10;
    if (city || address) score += 5;
    if (this.selectedBrandCount() > 0) score += 20;
    if (this.selectedProductCount() > 0) score += 10;
    if (this.businessCardCount() > 0) score += 10;
    return Math.min(100, score);
  });
}
