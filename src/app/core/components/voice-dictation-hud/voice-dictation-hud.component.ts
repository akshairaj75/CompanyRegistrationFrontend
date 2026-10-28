import { Component, HostListener, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SpeechRecognitionService } from '../../services/speech-recognition.service';

@Component({
  selector: 'app-voice-dictation-hud',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voice-dictation-hud.component.html',
  styleUrl: './voice-dictation-hud.component.css'
})
export class VoiceDictationHudComponent {
  readonly speechService = inject(SpeechRecognitionService);

  readonly currentLanguage = computed(() => {
    const code = this.speechService.selectedLanguage();
    return this.speechService.availableLanguages.find(l => l.code === code) || this.speechService.availableLanguages[0];
  });

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
