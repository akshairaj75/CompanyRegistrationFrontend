import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function phoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const val = control.value;
    if (!val || typeof val !== 'string' || !val.trim()) {
      return null;
    }
    const trimmed = val.trim();
    // Strictly reject any letters or words
    if (/[a-zA-Z]/.test(trimmed)) {
      return { containsLetters: true };
    }
    // Only allow digits and phone format symbols: +, -, (), spaces, .
    if (!/^[+]?[0-9\s\-().]{5,30}$/.test(trimmed)) {
      return { invalidPhoneFormat: true };
    }
    // Must contain at least 5 numeric digits
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 5) {
      return { minDigits: true };
    }
    return null;
  };
}
