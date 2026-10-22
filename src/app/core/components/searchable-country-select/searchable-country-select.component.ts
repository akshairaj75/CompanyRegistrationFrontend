import { Component, input, output, signal, computed, HostListener, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { COUNTRY_OPTIONS, CountryOption } from '../../models/country.model';

@Component({
  selector: 'app-searchable-country-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './searchable-country-select.component.html',
  styleUrl: './searchable-country-select.component.css'
})
export class SearchableCountrySelectComponent {
  private readonly elementRef = inject(ElementRef);

  readonly value = input<string>('');
  readonly isInvalid = input<boolean>(false);
  readonly placeholder = input<string>('Select Country...');
  readonly triggerId = input<string>('country-trigger-btn');

  readonly valueChange = output<string>();
  readonly countrySelected = output<CountryOption>();

  readonly isOpen = signal<boolean>(false);
  readonly searchQuery = signal<string>('');
  readonly countryOptions = COUNTRY_OPTIONS;

  readonly filteredOptions = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.countryOptions;
    return this.countryOptions.filter(c =>
      c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  });

  readonly selectedOption = computed(() => {
    const code = this.value();
    if (!code) return null;
    return this.countryOptions.find(c => c.code.toUpperCase() === code.toUpperCase()) || { code, name: code };
  });

  toggleDropdown(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      this.searchQuery.set('');
      setTimeout(() => {
        const inputEl = this.elementRef.nativeElement.querySelector('.country-search-input') as HTMLInputElement;
        if (inputEl) inputEl.focus();
      }, 50);
    }
  }

  closeDropdown(): void {
    this.isOpen.set(false);
  }

  selectCountry(code: string): void {
    const found = this.countryOptions.find(c => c.code.toUpperCase() === code.toUpperCase()) || { code, name: code };
    this.valueChange.emit(code);
    this.countrySelected.emit(found);
    this.isOpen.set(false);
    this.searchQuery.set('');
  }

  clearSelection(event: Event): void {
    event.stopPropagation();
    this.valueChange.emit('');
    this.searchQuery.set('');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }
}
