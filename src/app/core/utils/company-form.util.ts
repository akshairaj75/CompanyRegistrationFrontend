import { FormGroup } from '@angular/forms';

export const COMPANY_FIELD_LABELS: Record<string, string> = {
  companyName: 'Company Legal Name',
  email: 'Corporate Email',
  country: 'Country Jurisdiction',
  status: 'Operational Status',
  contactEmail: 'Direct Executive Email',
  contactMobileNumber: 'Mobile Number',
  landline: 'Landline Number',
  address: 'Street Address',
  city: 'City',
  website: 'Official Website',
  description: 'Company Overview & Scope',
  contactName: 'Contact Person Name',
  contactDesignation: 'Designation / Role'
};

export const COMPANY_CONTROL_ORDER: string[] = [
  'companyName',
  'status',
  'description',
  'contactName',
  'contactDesignation',
  'contactEmail',
  'contactMobileNumber',
  'email',
  'landline',
  'website',
  'address',
  'city',
  'country'
];

export const COMPANY_SELECTOR_MAP: Record<string, string> = {
  companyName: '#companyName',
  email: '#email',
  country: '#country-trigger-btn',
  contactEmail: '#contactEmail',
  contactMobileNumber: '#contactMobileNumber',
  landline: '#landline',
  status: '.status-segmented-control',
  address: '#address',
  city: '#city',
  website: '#website',
  description: '#description',
  contactName: '#contactName',
  contactDesignation: '#contactDesignation'
};

/**
 * Automatically scrolls to the first invalid control in the form,
 * pulses a highlight glow around it, and sets focus.
 */
export function scrollToFirstInvalidControl(
  form: FormGroup,
  onFeedback: (fb: { type: 'error'; title: string; message: string }) => void
): void {
  const invalidControls: string[] = [];
  for (const name of COMPANY_CONTROL_ORDER) {
    const ctrl = form.get(name);
    if (ctrl && ctrl.invalid) {
      invalidControls.push(name);
    }
  }
  for (const name in form.controls) {
    if (!COMPANY_CONTROL_ORDER.includes(name)) {
      const ctrl = form.get(name);
      if (ctrl && ctrl.invalid) {
        invalidControls.push(name);
      }
    }
  }

  if (invalidControls.length === 0) return;

  const missingLabels = invalidControls.map(k => COMPANY_FIELD_LABELS[k] || k);
  const firstName = missingLabels[0];
  const message = missingLabels.length === 1
    ? `Please fill in or correct "${firstName}". We've automatically scrolled to it.`
    : `Required fields incomplete (${missingLabels.slice(0, 3).join(', ')}${missingLabels.length > 3 ? '...' : ''}). Scrolled to "${firstName}".`;

  onFeedback({
    type: 'error',
    title: 'Form Incomplete',
    message
  });

  setTimeout(() => {
    let targetEl: HTMLElement | null = null;
    const firstKey = invalidControls[0];

    if (firstKey && COMPANY_SELECTOR_MAP[firstKey]) {
      targetEl = document.querySelector<HTMLElement>(COMPANY_SELECTOR_MAP[firstKey]);
    }

    if (!targetEl) {
      targetEl = document.querySelector<HTMLElement>(
        '.registration-form .ng-invalid:not(form), .registration-form .has-error, .registration-form .is-invalid'
      );
    }

    if (targetEl) {
      const containerToHighlight = targetEl.closest(
        '.form-group, .company-autocomplete-group, .asym-col-main, .country-form-group, .country-dropdown-container'
      ) || targetEl;

      // Smoothly scroll the element to the center of the viewport
      targetEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // Apply animated attention pulse glow
      containerToHighlight.classList.remove('invalid-field-pulse');
      void (containerToHighlight as HTMLElement).offsetWidth;
      containerToHighlight.classList.add('invalid-field-pulse');

      // Focus input or action button
      if (
        targetEl instanceof HTMLInputElement ||
        targetEl instanceof HTMLTextAreaElement ||
        targetEl instanceof HTMLSelectElement ||
        targetEl instanceof HTMLButtonElement
      ) {
        targetEl.focus({ preventScroll: true });
      } else {
        const innerFocusable = targetEl.querySelector<HTMLElement>('input, textarea, select, button');
        if (innerFocusable) {
          innerFocusable.focus({ preventScroll: true });
        }
      }

      // Remove pulse animation after 3 seconds
      setTimeout(() => {
        containerToHighlight.classList.remove('invalid-field-pulse');
      }, 3000);
    }
  }, 50);
}

/**
 * Checks whether a specific form control is invalid and has been touched or dirty.
 */
export function isFormControlInvalid(form: FormGroup, controlName: string): boolean {
  const control = form.get(controlName);
  return !!(control && control.invalid && (control.dirty || control.touched));
}

/**
 * Restricts keyboard typing to valid phone characters and navigation keys.
 */
export function allowOnlyPhoneChars(event: KeyboardEvent): void {
  if (
    event.key === 'Backspace' ||
    event.key === 'Delete' ||
    event.key === 'Tab' ||
    event.key === 'Escape' ||
    event.key === 'Enter' ||
    event.key === 'ArrowLeft' ||
    event.key === 'ArrowRight' ||
    event.key === 'Home' ||
    event.key === 'End' ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return;
  }

  if (!/^[0-9+\-\s().]$/.test(event.key)) {
    event.preventDefault();
  }
}

/**
 * Strips non-phone characters from pasted or autocompleted phone input values.
 */
export function sanitizePhoneInput(event: Event, form: FormGroup, controlName: string): void {
  const input = event.target as HTMLInputElement;
  const original = input.value;
  const sanitized = original.replace(/[^0-9+\-\s().]/g, '');
  if (original !== sanitized) {
    input.value = sanitized;
    form.get(controlName)?.setValue(sanitized);
    form.get(controlName)?.markAsDirty();
    form.get(controlName)?.updateValueAndValidity();
  }
}

/**
 * Handles Enter key presses inside the form:
 * - Prevents premature implicit form submission on single-line inputs.
 * - Smoothly shifts focus to the next logical input field (Tab-like flow).
 * - Preserves native multi-line Enter behavior inside <textarea>.
 * - Preserves native Enter submission on the submit button.
 */
export function handleFormEnterKey(event: KeyboardEvent): void {
  if (event.key !== 'Enter') return;

  const target = event.target as HTMLElement;
  if (!target) return;

  const tagName = target.tagName.toLowerCase();

  // Preserve normal multiline behavior for textareas
  if (tagName === 'textarea') {
    return;
  }

  // Preserve submission if explicitly pressing Enter on the submit button
  if (tagName === 'button' && (target as HTMLButtonElement).type === 'submit') {
    return;
  }

  // Allow other button clicks to proceed naturally
  if (tagName === 'button') {
    return;
  }

  // Prevent premature form submit
  event.preventDefault();

  const formElement = target.closest('form');
  if (!formElement) return;

  // Collect all focusable input elements in DOM order
  const focusable = Array.from(
    formElement.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([type="file"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]), button.country-select-trigger:not([disabled])'
    )
  );

  const currentIndex = focusable.indexOf(target);
  if (currentIndex > -1 && currentIndex < focusable.length - 1) {
    const nextEl = focusable[currentIndex + 1];
    nextEl.focus();
    nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Translates backend HTTP errors and network failures into clear,
 * human-readable explanations with actionable recovery advice.
 */
export function getHumanReadableHttpError(err: any, fallbackMessage: string): string {
  if (!err) return fallbackMessage;

  // Status 0: Backend server is offline or network disconnected
  if (err.status === 0) {
    return 'Unable to connect to the server. Please verify your internet connection or check that the backend service is running.';
  }

  // Session / Authentication errors
  if (err.status === 401) {
    return 'Your login session has expired. Please sign in again to continue.';
  }

  // Authorization / Permission errors
  if (err.status === 403) {
    return 'Access denied. You do not have permission to modify this company record.';
  }

  // Not found errors
  if (err.status === 404) {
    return 'The requested record was not found. It may have already been removed.';
  }

  // Conflict / Duplicate errors
  if (err.status === 409) {
    if (typeof err.error === 'string' && err.error.trim()) return err.error;
    if (err.error?.message) return err.error.message;
    return 'A company with this name or email already exists. Please choose a unique legal name.';
  }

  // Payload too large
  if (err.status === 413) {
    return 'The uploaded file(s) exceed the server size limit. Please upload smaller attachments.';
  }

  // Client validation error (400)
  if (err.status === 400) {
    if (typeof err.error === 'string' && err.error.trim()) return err.error;
    if (err.error?.message && typeof err.error.message === 'string') return err.error.message;
    return 'The submitted data was incomplete or invalid. Please check your form entries.';
  }

  // Server errors (500, 502, 503)
  if (err.status >= 500) {
    if (err.error?.message && typeof err.error.message === 'string' && !err.error.message.includes('Exception')) {
      return err.error.message;
    }
    return 'The server encountered an unexpected error while processing your request. Please try again shortly.';
  }

  // Generic message extractor if clean
  if (err.error?.message && typeof err.error.message === 'string') {
    return err.error.message;
  }

  return fallbackMessage;
}


