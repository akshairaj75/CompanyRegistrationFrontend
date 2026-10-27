import { Component, Input, Output, EventEmitter, inject, computed, OnInit, OnDestroy, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SpeechRecognitionService } from '../../services/speech-recognition.service';

@Component({
  selector: 'app-voice-mic-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './voice-mic-button.component.html',
  styleUrl: './voice-mic-button.component.css'
})
export class VoiceMicButtonComponent implements OnInit, OnDestroy {
  readonly speechService = inject(SpeechRecognitionService);

  @Input() control?: AbstractControl | null;
  @Input({ required: true }) fieldId!: string;
  @Input({ required: true }) label!: string;
  @Input() variant: 'icon' | 'pill' = 'icon';
  @Input() insideInput: boolean = true;
  @Input() pillLabel: string = 'Voice Dictate';
  @Input() pillListeningLabel: string = 'Listening...';
  @Input() value: string = '';

  @Output() valueChange = new EventEmitter<string>();
  @Output() transcriptChange = new EventEmitter<string>();

  @HostBinding('class.inside-input')
  get isInsideInput(): boolean {
    return this.variant === 'icon' && this.insideInput;
  }

  readonly isListening = computed(() => {
    return this.speechService.isListening() && this.speechService.activeFieldId() === this.fieldId;
  });

  private isInternalUpdate = false;
  private controlSub?: Subscription;

  ngOnInit(): void {
    if (this.control) {
      this.controlSub = this.control.valueChanges.subscribe(val => {
        if (this.isInternalUpdate) return;
        if (this.isListening()) {
          this.speechService.syncFieldText(val || '');
        }
      });
    }
  }

  toggleVoice(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!this.speechService.isSupported()) return;

    if (this.isListening()) {
      this.speechService.stopListening();
      return;
    }

    const currentVal = this.control ? (this.control.value || '') : (this.value || '');

    this.speechService.startListening(
      this.fieldId,
      this.label,
      currentVal,
      {
        onUpdate: (fullText: string) => {
          this.isInternalUpdate = true;

          if (this.control) {
            this.control.patchValue(fullText);
            this.control.markAsDirty();
            this.control.markAsTouched();
          }

          this.value = fullText;
          this.valueChange.emit(fullText);
          this.transcriptChange.emit(fullText);

          this.isInternalUpdate = false;
        }
      }
    );
  }

  ngOnDestroy(): void {
    this.controlSub?.unsubscribe();
    if (this.isListening()) {
      this.speechService.stopListening();
    }
  }
}
