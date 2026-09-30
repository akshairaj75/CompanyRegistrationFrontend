import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CompanyService } from '../../core/services/company';
import { CompanyRequest, CompanyResponse } from '../../core/models/company.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-company-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './company-register.component.html',
  styleUrl: './company-register.component.css'
})
export class CompanyRegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly companyService = inject(CompanyService);
  readonly environment = environment;

  // State Signals
  readonly isSubmitting = signal<boolean>(false);
  readonly isLoadingList = signal<boolean>(false);
  readonly activeTab = signal<'register' | 'directory'>('register');
  readonly feedback = signal<{ type: 'success' | 'error'; title: string; message: string } | null>(null);

  // File Upload State
  readonly selectedFile = signal<File | null>(null);
  readonly filePreviewUrl = signal<string | null>(null);
  readonly isPdfFile = signal<boolean>(false);
  readonly isDragOver = signal<boolean>(false);

  // Companies List State
  readonly companies = signal<CompanyResponse[]>([]);
  readonly searchQuery = signal<string>('');

  // Selected Company for detail modal
  readonly selectedCompany = signal<CompanyResponse | null>(null);

  // Form Definition
  companyForm: FormGroup = this.fb.group({
    companyName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    registrationNumber: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    phone: ['', [Validators.maxLength(30)]],
    address: ['', [Validators.maxLength(255)]],
    city: ['', [Validators.maxLength(100)]],
    state: ['', [Validators.maxLength(100)]],
    country: ['United States', [Validators.maxLength(100)]],
    website: ['', [Validators.maxLength(255)]],
    description: ['', [Validators.maxLength(1000)]],
    status: ['ACTIVE', [Validators.required]]
  });

  ngOnInit(): void {
    this.fetchCompanies();
  }

  fetchCompanies(): void {
    this.isLoadingList.set(true);
    this.companyService.getAllCompanies().subscribe({
      next: (data) => {
        this.companies.set(data || []);
        this.isLoadingList.set(false);
      },
      error: (err) => {
        console.error('Failed to load companies:', err);
        this.isLoadingList.set(false);
      }
    });
  }

  // File Drag & Drop & Selection Handlers
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
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    const maxSizeBytes = 20 * 1024 * 1024; // 20 MB

    if (!allowedTypes.includes(file.type)) {
      this.feedback.set({
        type: 'error',
        title: 'Unsupported File Format',
        message: 'Please upload a JPEG, PNG, WEBP, GIF, or PDF document.'
      });
      return;
    }

    if (file.size > maxSizeBytes) {
      this.feedback.set({
        type: 'error',
        title: 'File Too Large',
        message: 'Max file size allowed is 20MB.'
      });
      return;
    }

    this.selectedFile.set(file);
    const isPdf = file.type === 'application/pdf';
    this.isPdfFile.set(isPdf);

    if (isPdf) {
      this.filePreviewUrl.set(null);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.filePreviewUrl.set(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  removeFile(event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedFile.set(null);
    this.filePreviewUrl.set(null);
    this.isPdfFile.set(false);
  }

  // Form Submission
  onSubmit(): void {
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      this.feedback.set({
        type: 'error',
        title: 'Validation Error',
        message: 'Please fill in all mandatory fields correctly before proceeding.'
      });
      return;
    }

    this.isSubmitting.set(true);
    this.feedback.set(null);

    const formValues = this.companyForm.value;
    const requestData: CompanyRequest = {
      companyName: formValues.companyName.trim(),
      registrationNumber: formValues.registrationNumber.trim(),
      email: formValues.email.trim(),
      phone: formValues.phone ? formValues.phone.trim() : '',
      address: formValues.address ? formValues.address.trim() : '',
      city: formValues.city ? formValues.city.trim() : '',
      state: formValues.state ? formValues.state.trim() : '',
      country: formValues.country ? formValues.country.trim() : '',
      website: formValues.website ? formValues.website.trim() : '',
      description: formValues.description ? formValues.description.trim() : '',
      status: formValues.status || 'ACTIVE'
    };

    const fileToUpload = this.selectedFile();

    this.companyService.createCompany(requestData, fileToUpload).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        this.feedback.set({
          type: 'success',
          title: 'Company Registered Successfully!',
          message: `"${response.companyName}" has been established with ID #${response.id}.`
        });
        this.resetForm();
        this.fetchCompanies();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        console.error('Registration failed:', err);
        const errMsg = err?.error?.message || err?.message || 'Server error occurred during company creation.';
        this.feedback.set({
          type: 'error',
          title: 'Registration Failed',
          message: `${errMsg}. Ensure the Spring Boot backend is active at port 8080.`
        });
      }
    });
  }

  resetForm(): void {
    this.companyForm.reset({
      companyName: '',
      registrationNumber: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      country: 'United States',
      website: '',
      description: '',
      status: 'ACTIVE'
    });
    this.removeFile();
  }

  closeFeedback(): void {
    this.feedback.set(null);
  }

  openCompanyDetail(comp: CompanyResponse): void {
    this.selectedCompany.set(comp);
  }

  closeCompanyDetail(): void {
    this.selectedCompany.set(null);
  }

  // Filtered companies based on search
  get filteredCompanies(): CompanyResponse[] {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.companies();
    return this.companies().filter(c => 
      c.companyName?.toLowerCase().includes(query) ||
      c.registrationNumber?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.city?.toLowerCase().includes(query) ||
      c.country?.toLowerCase().includes(query)
    );
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  // Helpers for validation styling
  isInvalid(controlName: string): boolean {
    const control = this.companyForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
