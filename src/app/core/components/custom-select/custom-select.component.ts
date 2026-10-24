import {
  Component,
  forwardRef,
  input,
  output,
  signal,
  computed,
  ElementRef,
  inject,
  HostListener,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { CustomSelectOption } from './custom-select.model';

@Component({
  selector: 'app-custom-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSelectComponent),
      multi: true
    }
  ],
  templateUrl: './custom-select.component.html',
  styleUrl: './custom-select.component.css'
})
export class CustomSelectComponent implements ControlValueAccessor {
  private readonly elementRef: ElementRef | null;

  constructor() {
    try {
      this.elementRef = inject(ElementRef, { optional: true });
    } catch {
      this.elementRef = null;
    }
  }

  // Inputs
  readonly options = input<CustomSelectOption[]>([]);
  readonly value = input<any>(undefined);
  readonly placeholder = input<string>('Select an option...');
  readonly leadingIcon = input<string>('');
  readonly searchable = input<boolean>(false);
  readonly searchPlaceholder = input<string>('Search options...');
  readonly clearable = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly isInvalid = input<boolean>(false);
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly variant = input<'default' | 'filter' | 'compact'>('default');
  readonly triggerId = input<string>('');
  readonly ariaLabel = input<string>('');

  // Outputs
  readonly valueChange = output<any>();
  readonly optionSelected = output<CustomSelectOption>();
  readonly dropdownOpened = output<void>();
  readonly dropdownClosed = output<void>();

  // State signals
  readonly isOpen = signal<boolean>(false);
  readonly searchQuery = signal<string>('');
  readonly highlightedIndex = signal<number>(-1);
  readonly internalValue = signal<any>(null);
  readonly formDisabled = signal<boolean>(false);

  // ControlValueAccessor callbacks
  private onChange: (val: any) => void = () => {};
  private onTouched: () => void = () => {};

  readonly effectiveDisabled = computed(() => {
    return this.disabled() || this.formDisabled();
  });

  readonly currentValue = computed(() => {
    const externalVal = this.value();
    if (externalVal !== undefined) {
      return externalVal;
    }
    return this.internalValue();
  });

  readonly selectedOption = computed(() => {
    const cur = this.currentValue();
    if (cur === null || cur === undefined || cur === '') return null;
    return this.options().find(opt => this.areValuesEqual(opt.value, cur)) || null;
  });

  readonly filteredOptions = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const list = this.options();
    if (!query) return list;
    return list.filter(opt =>
      (opt.label && opt.label.toLowerCase().includes(query)) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(query)) ||
      (opt.badge !== undefined && String(opt.badge).toLowerCase().includes(query))
    );
  });

  // ControlValueAccessor methods
  writeValue(obj: any): void {
    this.internalValue.set(obj);
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  // Dropdown Actions
  toggleDropdown(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (this.effectiveDisabled()) return;

    if (this.isOpen()) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown(): void {
    if (this.effectiveDisabled() || this.isOpen()) return;
    this.isOpen.set(true);
    this.searchQuery.set('');
    this.highlightedIndex.set(-1);
    this.dropdownOpened.emit();

    if (this.searchable()) {
      setTimeout(() => {
        const searchInput = this.elementRef?.nativeElement?.querySelector('.custom-select-search-input') as HTMLInputElement | undefined;
        if (searchInput) searchInput.focus();
      }, 50);
    }
  }

  closeDropdown(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.searchQuery.set('');
    this.highlightedIndex.set(-1);
    this.onTouched();
    this.dropdownClosed.emit();
  }

  selectOption(option: CustomSelectOption, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (option.disabled || this.effectiveDisabled()) return;

    this.internalValue.set(option.value);
    this.onChange(option.value);
    this.valueChange.emit(option.value);
    this.optionSelected.emit(option);
    this.closeDropdown();
  }

  clearSelection(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.effectiveDisabled()) return;

    this.internalValue.set(null);
    this.onChange(null);
    this.valueChange.emit(null);
    this.searchQuery.set('');
  }

  onKeyDown(event: KeyboardEvent): void {
    if (this.effectiveDisabled()) return;

    if (!this.isOpen()) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        this.openDropdown();
      }
      return;
    }

    const opts = this.filteredOptions();
    if (opts.length === 0) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeDropdown();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const current = this.highlightedIndex();
      const next = current + 1 >= opts.length ? 0 : current + 1;
      this.highlightedIndex.set(next);
      this.scrollHighlightedIntoView();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const current = this.highlightedIndex();
      const prev = current <= 0 ? opts.length - 1 : current - 1;
      this.highlightedIndex.set(prev);
      this.scrollHighlightedIntoView();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const idx = this.highlightedIndex();
      if (idx >= 0 && idx < opts.length) {
        this.selectOption(opts[idx]);
      } else if (opts.length === 1) {
        this.selectOption(opts[0]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDropdown();
    } else if (event.key === 'Tab') {
      this.closeDropdown();
    }
  }

  private scrollHighlightedIntoView(): void {
    setTimeout(() => {
      const container = this.elementRef?.nativeElement?.querySelector('.custom-select-options-list');
      const highlightedEl = this.elementRef?.nativeElement?.querySelector('.custom-select-option.is-highlighted');
      if (container && highlightedEl) {
        const cTop = container.scrollTop;
        const cHeight = container.clientHeight;
        const eTop = highlightedEl.offsetTop;
        const eHeight = highlightedEl.offsetHeight;

        if (eTop < cTop) {
          container.scrollTop = eTop;
        } else if (eTop + eHeight > cTop + cHeight) {
          container.scrollTop = eTop + eHeight - cHeight;
        }
      }
    }, 10);
  }

  areValuesEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a === null || a === undefined || b === null || b === undefined) return false;
    return String(a).trim() === String(b).trim();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.elementRef?.nativeElement && !this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }
}
