import { Component, inject } from '@angular/core';
import { SettingsService } from './settings.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  // Restore the theme before any routed page is displayed.
  private readonly settings = inject(SettingsService);
}
