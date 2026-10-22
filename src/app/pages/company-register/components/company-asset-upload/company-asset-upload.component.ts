import { Component, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BusinessCardItem } from '../../../../core/models/company.model';

@Component({
  selector: 'app-company-asset-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './company-asset-upload.component.html',
  styleUrl: './company-asset-upload.component.css'
})
export class CompanyAssetUploadComponent {
  readonly items = model<BusinessCardItem[]>([]);
  readonly isDragOver = signal<boolean>(false);

  readonly feedback = output<{ type: 'error' | 'success'; title: string; message: string }>();
  readonly scanCard = output<File>();
  readonly scanExisting = output<BusinessCardItem>();

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
      this.addFiles(Array.from(event.dataTransfer.files));
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.addFiles(Array.from(input.files));
      input.value = '';
    }
  }

  addFiles(files: File[]): void {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    const maxSizeBytes = 20 * 1024 * 1024; // 20 MB

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        this.feedback.emit({
          type: 'error',
          title: 'Unsupported File Format',
          message: `"${file.name}" has an unsupported format. Please upload JPEG, PNG, WEBP, GIF, or PDF.`
        });
        continue;
      }

      if (file.size > maxSizeBytes) {
        this.feedback.emit({
          type: 'error',
          title: 'File Too Large',
          message: `"${file.name}" exceeds the 20MB limit.`
        });
        continue;
      }

      const isPdf = file.type === 'application/pdf';
      const id = 'new-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

      if (isPdf) {
        this.items.update(items => [
          ...items,
          {
            id,
            name: file.name,
            isPdf: true,
            isExisting: false,
            file,
            size: file.size
          }
        ]);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.items.update(items => [
            ...items,
            {
              id,
              name: file.name,
              url: e.target?.result as string,
              isPdf: false,
              isExisting: false,
              file,
              size: file.size
            }
          ]);
        };
        reader.readAsDataURL(file);
      }
    }
  }

  removeCardItem(item: BusinessCardItem, event?: Event): void {
    if (event) event.stopPropagation();
    this.items.update(items => items.filter(c => c.id !== item.id));
  }

  clearAllCards(event?: Event): void {
    if (event) event.stopPropagation();
    this.items.set([]);
  }

  onOcrFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.scanCard.emit(input.files[0]);
      input.value = '';
    }
  }

  triggerScanExisting(item: BusinessCardItem, event?: Event): void {
    if (event) event.stopPropagation();
    this.scanExisting.emit(item);
  }
}
