import { Component, inject } from '@angular/core';
import type { ToggleCustomEvent } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline, moonOutline, notificationsOutline } from 'ionicons/icons';
import { SettingsService } from '../settings.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage {
  readonly settings = inject(SettingsService);

  constructor() {
    addIcons({ arrowBackOutline, moonOutline, notificationsOutline });
  }

  async changeReminders(event: ToggleCustomEvent): Promise<void> {
    await this.settings.setReminders(event.detail.checked);
    // Ionic changes its own checked state before asking for permission.
    // Restore it explicitly if the request was denied or dismissed.
    event.target.checked = this.settings.remindersEnabled();
  }

  ionViewWillEnter(): void {
    this.settings.refreshPermission();
  }
}
