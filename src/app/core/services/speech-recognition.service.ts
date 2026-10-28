import { Injectable, signal } from '@angular/core';

export interface SpeechLanguageOption {
  code: string;
  label: string;
  flag: string;
}

export const SPEECH_LANGUAGES: SpeechLanguageOption[] = [
  { code: 'ar-SA', label: 'العربية (السعودية)', flag: '🇸🇦' },
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { code: 'en-IN', label: 'English (India)', flag: '🇮🇳' },
  { code: 'hi-IN', label: 'Hindi (हिंदी)', flag: '🇮🇳' },
  { code: 'ml-IN', label: 'Malayalam (മലയാളം)', flag: '🇮🇳' },
  { code: 'ta-IN', label: 'Tamil (தமிழ்)', flag: '🇮🇳' }
];

export interface SpeechRecognitionCallbacks {
  onUpdate: (fullText: string, isFinal: boolean) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

@Injectable({
  providedIn: 'root'
})
export class SpeechRecognitionService {
  private recognition: any = null;
  private currentCallbacks: SpeechRecognitionCallbacks | null = null;
  private basePrefixText = '';
  private lastSessionFinal = '';
  private lastEmittedText = '';
  private userRequestedStop = false;

  // Auto-stop silence timer: 5 seconds with no spoken words
  private silenceTimer: any = null;
  readonly silenceTimeoutMs = signal<number>(8000);

  // Web Audio API for real-time sound visualization
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private audioAnimFrameId: number | null = null;

  readonly isSupported = signal<boolean>(false);
  readonly isListening = signal<boolean>(false);
  readonly activeFieldId = signal<string | null>(null);
  readonly activeFieldLabel = signal<string>('');
  readonly interimTranscript = signal<string>('');
  readonly selectedLanguage = signal<string>('ar-SA');
  readonly errorMessage = signal<string | null>(null);
  readonly isProgrammaticUpdate = signal<boolean>(false);

  // Dynamic audio frequency wave heights (percentage 10 - 100)
  readonly waveBars = signal<number[]>([15, 20, 15, 25, 18]);
  readonly audioLevel = signal<number>(0);

  readonly availableLanguages = SPEECH_LANGUAGES;

  constructor() {
    this.checkSupport();
    this.loadSavedLanguage();
  }

  private checkSupport(): void {
    if (typeof window !== 'undefined') {
      const win = window as any;
      const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        this.isSupported.set(true);
      }
    }
  }

  private loadSavedLanguage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('preferred_speech_lang');
      if (saved && SPEECH_LANGUAGES.some(l => l.code === saved)) {
        this.selectedLanguage.set(saved);
        return;
      }
    }
    // Default to Saudi Arabic for Saudi Arabia focused system
    this.selectedLanguage.set('ar-SA');
  }

  /**
   * Resets the inactivity/silence countdown timer.
   * If no voice input or speech result is received for silenceTimeoutMs (8s),
   * the microphone cleanly auto-stops.
   */
  private resetSilenceTimer(): void {
    this.clearSilenceTimer();
    if (!this.isListening()) return;

    this.silenceTimer = setTimeout(() => {
      if (this.isListening()) {
        this.stopListening();
      }
    }, this.silenceTimeoutMs());
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  /**
   * Configures custom silence timeout in milliseconds (minimum 3s, maximum 60s).
   */
  setSilenceTimeout(ms: number): void {
    if (ms >= 3000 && ms <= 60000) {
      this.silenceTimeoutMs.set(ms);
      if (this.isListening()) {
        this.resetSilenceTimer();
      }
    }
  }

  /**
   * Initializes Web Audio Analyser to produce live dancing waveform bars
   */
  private startAudioAnalysis(): void {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      this.mediaStream = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.6;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateAudioVisuals = () => {
        if (!this.analyser || !this.isListening()) return;

        this.analyser.getByteFrequencyData(dataArray);

        // Calculate general volume level
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalizedVolume = Math.min(100, Math.round((avg / 128) * 100));
        this.audioLevel.set(normalizedVolume);

        // Generate 5 dynamic equalizer bars
        const b1 = Math.max(14, Math.min(100, Math.round((dataArray[1] / 255) * 100)));
        const b2 = Math.max(18, Math.min(100, Math.round((dataArray[3] / 255) * 100)));
        const b3 = Math.max(24, Math.min(100, Math.round((dataArray[6] / 255) * 100)));
        const b4 = Math.max(18, Math.min(100, Math.round((dataArray[9] / 255) * 100)));
        const b5 = Math.max(14, Math.min(100, Math.round((dataArray[12] / 255) * 100)));

        this.waveBars.set([b1, b2, b3, b4, b5]);

        this.audioAnimFrameId = requestAnimationFrame(updateAudioVisuals);
      };

      updateAudioVisuals();
    }).catch(() => {
      // AudioContext failure is non-fatal: fallback to gentle pulse
    });
  }

  private stopAudioAnalysis(): void {
    if (this.audioAnimFrameId) {
      cancelAnimationFrame(this.audioAnimFrameId);
      this.audioAnimFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        // Safe ignore
      }
      this.audioContext = null;
    }
    this.analyser = null;
    this.audioLevel.set(0);
    this.waveBars.set([15, 20, 15, 25, 18]);
  }

  private cleanupActiveRecognition(): void {
    this.clearSilenceTimer();
    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.abort();
      } catch {
        // Safe ignore
      }
      this.recognition = null;
    }
  }

  /**
   * Starts a clean listening session for a specific field.
   */
  startListening(
    fieldId: string,
    fieldLabel: string,
    existingText: string,
    callbacks: SpeechRecognitionCallbacks
  ): void {
    if (typeof window === 'undefined') return;
    const win = window as any;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      this.errorMessage.set('Speech recognition is not supported in this browser.');
      return;
    }

    this.cleanupActiveRecognition();
    this.stopAudioAnalysis();
    this.clearSilenceTimer();

    this.userRequestedStop = false;
    this.activeFieldId.set(fieldId);
    this.activeFieldLabel.set(fieldLabel);
    this.currentCallbacks = callbacks;

    const trimmed = (existingText || '').trimEnd();
    this.basePrefixText = trimmed ? trimmed + ' ' : '';
    this.lastSessionFinal = '';
    this.lastEmittedText = existingText || '';
    this.interimTranscript.set('');
    this.errorMessage.set(null);

    const rec = new SpeechRecognitionClass();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = this.selectedLanguage();

    rec.onstart = () => {
      this.isListening.set(true);
      this.errorMessage.set(null);
      this.startAudioAnalysis();
      this.resetSilenceTimer();
    };

    rec.onresult = (event: any) => {
      let sessionFinal = '';
      let interim = '';

      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i];
        const transcript = item[0]?.transcript || '';
        if (item.isFinal) {
          sessionFinal += transcript + ' ';
        } else {
          interim += transcript;
        }
      }

      // Reset timer ONLY when actual words/transcription are detected
      if ((sessionFinal + interim).trim().length > 0) {
        this.resetSilenceTimer();
      }

      this.lastSessionFinal = sessionFinal;
      this.interimTranscript.set(interim);

      let totalResult = (this.basePrefixText + sessionFinal + interim).trimStart();
      totalResult = this.formatSpokenText(totalResult);

      this.isProgrammaticUpdate.set(true);
      this.lastEmittedText = totalResult;

      if (this.currentCallbacks) {
        this.currentCallbacks.onUpdate(totalResult, interim.length === 0);
      }

      // Reset programmatic flag after Angular change detection pass
      queueMicrotask(() => {
        this.isProgrammaticUpdate.set(false);
      });
    };

    rec.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        // Pausing is normal; silence timer handles auto-timeout
        return;
      }
      if (event.error === 'aborted') {
        return;
      }

      let friendlyError = 'Speech recognition error.';
      if (event.error === 'not-allowed') {
        friendlyError = 'Microphone permission denied. Please allow microphone access in your browser settings.';
      } else if (event.error === 'network') {
        friendlyError = 'Network error during speech recognition.';
      }
      this.errorMessage.set(friendlyError);
      if (this.currentCallbacks?.onError) {
        this.currentCallbacks.onError(friendlyError);
      }
    };

    rec.onend = () => {
      // If user did not explicitly stop and we're still listening (Chrome silence timeout):
      if (!this.userRequestedStop && this.isListening() && this.activeFieldId()) {
        try {
          this.basePrefixText = (this.basePrefixText + this.lastSessionFinal).trimEnd();
          if (this.basePrefixText) this.basePrefixText += ' ';
          this.lastSessionFinal = '';
          rec.start();
          return;
        } catch {
          // Restart failed, proceed to full shutdown
        }
      }

      this.handleFullStop();
    };

    this.recognition = rec;

    try {
      rec.start();
    } catch (err: any) {
      this.errorMessage.set('Could not activate microphone: ' + (err.message || err));
      this.cleanupActiveRecognition();
      this.isListening.set(false);
    }
  }

  private handleFullStop(): void {
    this.clearSilenceTimer();
    this.isListening.set(false);
    this.activeFieldId.set(null);
    this.activeFieldLabel.set('');
    this.interimTranscript.set('');
    this.stopAudioAnalysis();
    if (this.currentCallbacks?.onEnd) {
      this.currentCallbacks.onEnd();
    }
    this.cleanupActiveRecognition();
  }

  /**
   * Synchronizes active speech session when user MANUALLY types into field via keyboard.
   * Ignores programmatic updates emitted by speech recognition itself.
   */
  syncFieldText(newText: string): void {
    // If update came from our own speech recognition, ignore to prevent vicious abort loop
    if (this.isProgrammaticUpdate()) {
      return;
    }

    const trimmedNew = (newText || '').trim();
    const trimmedLast = (this.lastEmittedText || '').trim();
    if (trimmedNew === trimmedLast) {
      return;
    }

    const trimmed = (newText || '').trimEnd();
    this.basePrefixText = trimmed ? trimmed + ' ' : '';
    this.lastSessionFinal = '';
    this.interimTranscript.set('');
    this.lastEmittedText = newText || '';

    // If currently listening and user genuinely edited text, restart recognition to sync Chrome buffer
    if (this.isListening() && this.activeFieldId() && this.currentCallbacks) {
      const fieldId = this.activeFieldId()!;
      const label = this.activeFieldLabel();
      const callbacks = this.currentCallbacks;

      this.cleanupActiveRecognition();
      setTimeout(() => {
        this.startListening(fieldId, label, newText, callbacks);
      }, 50);
    }
  }

  /**
   * Stops active listening session.
   */
  stopListening(): void {
    this.userRequestedStop = true;
    this.clearSilenceTimer();
    this.stopAudioAnalysis();
    this.cleanupActiveRecognition();
    this.isListening.set(false);
    this.activeFieldId.set(null);
    this.activeFieldLabel.set('');
    this.interimTranscript.set('');
    this.currentCallbacks = null;
  }

  /**
   * Changes spoken language and saves preference.
   */
  setLanguage(langCode: string): void {
    this.selectedLanguage.set(langCode);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('preferred_speech_lang', langCode);
      } catch {
        // Safe ignore
      }
    }

    if (this.isListening() && this.activeFieldId() && this.currentCallbacks) {
      const fieldId = this.activeFieldId()!;
      const label = this.activeFieldLabel();
      const callbacks = this.currentCallbacks;
      const base = (this.basePrefixText + this.lastSessionFinal).trimEnd();

      this.stopListening();
      setTimeout(() => {
        this.startListening(fieldId, label, base, callbacks);
      }, 100);
    }
  }

  /**
   * Formats speech text with clean spacing and proper sentence capitalization.
   */
  private formatSpokenText(text: string): string {
    if (!text) return '';
    let formatted = text.replace(/[ ]{2,}/g, ' ');

    // For non-Arabic (Latin) text, ensure first letter of sentence is capitalized
    if (!/^[\u0600-\u06FF]/.test(formatted)) {
      formatted = formatted.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_m, p1, p2) => p1 + p2.toUpperCase());
    }

    return formatted;
  }
}
