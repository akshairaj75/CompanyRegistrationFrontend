import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpeechRecognitionService } from '../../services/speech-recognition.service';

@Component({
  selector: 'app-voice-dictation-hud',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './voice-dictation-hud.component.html',
  styleUrl: './voice-dictation-hud.component.css'
})
export class VoiceDictationHudComponent {
  readonly speechService = inject(SpeechRecognitionService);

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.speechService.isListening()) {
      this.speechService.stopListening();
    }
  }

  stopListening(): void {
    this.speechService.stopListening();
  }

  onLanguageChange(langCode: string): void {
    this.speechService.setLanguage(langCode);
  }
}
