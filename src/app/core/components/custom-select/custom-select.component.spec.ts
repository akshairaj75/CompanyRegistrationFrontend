import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { createEnvironmentInjector, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { CustomSelectComponent } from './custom-select.component';
import { CustomSelectOption } from './custom-select.model';

describe('CustomSelectComponent', () => {
  let component: CustomSelectComponent;
  let injector: EnvironmentInjector;

  const mockOptions: CustomSelectOption[] = [
    { value: 'apple', label: 'Apple', badge: 'Fruit' },
    { value: 'banana', label: 'Banana', badge: 'Fruit' },
    { value: 'carrot', label: 'Carrot', badge: 'Vegetable' }
  ];

  beforeEach(() => {
    injector = createEnvironmentInjector([], null as any);
    runInInjectionContext(injector, () => {
      component = new CustomSelectComponent();
    });
    (component.options as any) = () => mockOptions;
  });

  it('should initialize with dropdown closed and null selectedOption', () => {
    expect(component.isOpen()).toBe(false);
    expect(component.selectedOption()).toBeNull();
  });

  it('should toggle dropdown open and close', () => {
    component.toggleDropdown();
    expect(component.isOpen()).toBe(true);

    component.toggleDropdown();
    expect(component.isOpen()).toBe(false);
  });

  it('should select an option and emit valueChange and update internalValue', () => {
    let emittedVal: any = null;
    component.valueChange.subscribe(v => (emittedVal = v));

    component.openDropdown();
    expect(component.isOpen()).toBe(true);

    component.selectOption(mockOptions[1]);
    expect(emittedVal).toBe('banana');
    expect(component.isOpen()).toBe(false);
    expect(component.currentValue()).toBe('banana');
    expect(component.selectedOption()?.label).toBe('Banana');
  });

  it('should filter options by label, sublabel, or badge', () => {
    component.searchQuery.set('car');
    const filtered = component.filteredOptions();
    expect(filtered.length).toBe(1);
    expect(filtered[0].value).toBe('carrot');

    component.searchQuery.set('fruit');
    const fruits = component.filteredOptions();
    expect(fruits.length).toBe(2);
  });

  it('should support ControlValueAccessor writeValue', () => {
    component.writeValue('apple');
    expect(component.currentValue()).toBe('apple');
    expect(component.selectedOption()?.label).toBe('Apple');
  });

  it('should handle keyboard navigation with ArrowDown and Enter', () => {
    component.openDropdown();

    const eventDown = { key: 'ArrowDown', preventDefault: () => {} } as unknown as KeyboardEvent;
    component.onKeyDown(eventDown);
    expect(component.highlightedIndex()).toBe(0);

    const eventEnter = { key: 'Enter', preventDefault: () => {} } as unknown as KeyboardEvent;
    component.onKeyDown(eventEnter);
    expect(component.currentValue()).toBe('apple');
    expect(component.isOpen()).toBe(false);
  });

  it('should close on Escape key', () => {
    component.openDropdown();
    expect(component.isOpen()).toBe(true);

    const eventEsc = { key: 'Escape', preventDefault: () => {} } as unknown as KeyboardEvent;
    component.onKeyDown(eventEsc);
    expect(component.isOpen()).toBe(false);
  });

  it('should respect disabled state and prevent opening', () => {
    (component.disabled as any) = () => true;

    component.toggleDropdown();
    expect(component.isOpen()).toBe(false);
  });

  it('should match values whether number or string (loose equality)', () => {
    expect(component.areValuesEqual(1, '1')).toBe(true);
    expect(component.areValuesEqual('test', 'test')).toBe(true);
    expect(component.areValuesEqual(1, 2)).toBe(false);
    expect(component.areValuesEqual(null, undefined)).toBe(false);
  });
});
