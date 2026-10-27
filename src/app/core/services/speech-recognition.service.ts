import { Injectable, signal } from '@angular/core';

export interface SpeechLanguageOption {
  code: string;
  label: string;
  flag?: string;
}

export const SPEECH_LANGUAGES: SpeechLanguageOption[] = [
  { code: 'en-IN', label: 'Indian English' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'hi-IN', label: 'Hindi (हिंदी)' },
  { code: 'ml-IN', label: 'Malayalam (മലയാളം)' },
  { code: 'ta-IN', label: 'Tamil (தமிழ்)' },
  { code: 'ar-SA', label: 'Arabic (العربية)' }
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

  readonly isSupported = signal<boolean>(false);
  readonly isListening = signal<boolean>(false);
  readonly activeFieldId = signal<string | null>(null);
  readonly activeFieldLabel = signal<string>('');
  readonly interimTranscript = signal<string>('');
  readonly selectedLanguage = signal<string>('en-IN');
  readonly errorMessage = signal<string | null>(null);

  readonly availableLanguages = SPEECH_LANGUAGES;

  constructor() {
    this.checkSupport();
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

  private cleanupActiveRecognition(): void {
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
   * If existingText is provided, speech will append to it. If existingText is empty,
   * speech starts completely from scratch.
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

    // Always clean up any existing recognition session to avoid state leakage or lingering results
    this.cleanupActiveRecognition();

    this.activeFieldId.set(fieldId);
    this.activeFieldLabel.set(fieldLabel);
    this.currentCallbacks = callbacks;

    const trimmed = (existingText || '').trimEnd();
    this.basePrefixText = trimmed ? trimmed + ' ' : '';
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

      this.interimTranscript.set(interim);

      const totalResult = (this.basePrefixText + sessionFinal + interim).trimStart();
      if (this.currentCallbacks) {
        this.currentCallbacks.onUpdate(totalResult, interim.length === 0);
      }
    };

    rec.onerror = (event: any) => {
      let friendlyError = 'Speech recognition error.';
      if (event.error === 'not-allowed') {
        friendlyError = 'Microphone access was denied. Please allow microphone permissions in your browser.';
      } else if (event.error === 'no-speech') {
        // Non-fatal for continuous mode, user is just pausing
        return;
      } else if (event.error === 'network') {
        friendlyError = 'Network error during voice recognition.';
      } else if (event.error === 'aborted') {
        return;
      }
      this.errorMessage.set(friendlyError);
      if (this.currentCallbacks?.onError) {
        this.currentCallbacks.onError(friendlyError);
      }
    };

    rec.onend = () => {
      this.isListening.set(false);
      this.activeFieldId.set(null);
      this.activeFieldLabel.set('');
      this.interimTranscript.set('');
      if (this.currentCallbacks?.onEnd) {
        this.currentCallbacks.onEnd();
      }
      this.cleanupActiveRecognition();
    };

    this.recognition = rec;

    try {
      rec.start();
    } catch (err: any) {
      this.errorMessage.set('Could not start microphone: ' + (err.message || err));
      this.cleanupActiveRecognition();
      this.isListening.set(false);
    }
  }

  /**
   * Synchronizes the active speech session if the user manually cleared or edited
   * the text in the field while listening is in progress.
   */
  syncFieldText(newText: string): void {
    const trimmed = (newText || '').trimEnd();
    this.basePrefixText = trimmed ? trimmed + ' ' : '';
    this.interimTranscript.set('');

    // If currently listening, re-instantiate recognition so Chrome's internal result buffer resets
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
   * Stops active listening session and immediately aborts audio capture.
   */
  stopListening(): void {
    this.cleanupActiveRecognition();
    this.isListening.set(false);
    this.activeFieldId.set(null);
    this.activeFieldLabel.set('');
    this.interimTranscript.set('');
    this.currentCallbacks = null;
  }

  /**
   * Changes the spoken language.
   * If currently listening, restarts recognition with the new language.
   */
  setLanguage(langCode: string): void {
    this.selectedLanguage.set(langCode);
    if (this.isListening() && this.activeFieldId() && this.currentCallbacks) {
      const fieldId = this.activeFieldId()!;
      const label = this.activeFieldLabel();
      const callbacks = this.currentCallbacks;
      const base = this.basePrefixText.trimEnd();

      this.stopListening();
      setTimeout(() => {
        this.startListening(fieldId, label, base, callbacks);
      }, 100);
    }
  }
}
