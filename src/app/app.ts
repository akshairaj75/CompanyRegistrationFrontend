import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VoiceDictationHudComponent } from './core/components/voice-dictation-hud/voice-dictation-hud.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, VoiceDictationHudComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('company-app');
}
