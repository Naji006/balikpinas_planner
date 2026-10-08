import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

const STORAGE_KEY = 'balikpinas:settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly document = inject(DOCUMENT);
  private readonly activeNotifications = new Set<Notification>();
  private permissionRequest = 0;
  private readonly dark = signal(false);
  private readonly reminders = signal(false);
  readonly darkMode = this.dark.asReadonly();
  readonly remindersEnabled = this.reminders.asReadonly();
  readonly requestingPermission = signal(false);
  readonly notificationMessage = signal('');
  readonly storageMessage = signal('');

  constructor() {
    let saved: { darkMode?: unknown; remindersEnabled?: unknown } = {};
    try {
      const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      if (value && typeof value === 'object') saved = value;
    } catch {
      this.storageMessage.set('Settings could not be restored. Changes apply for this visit.');
    }
    this.dark.set(typeof saved.darkMode === 'boolean' ? saved.darkMode
      : this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
    this.reminders.set(saved.remindersEnabled === true);
    this.applyTheme();
    this.refreshPermission();
    const refresh = () => this.refreshPermission();
    this.document.defaultView?.addEventListener('focus', refresh);
    inject(DestroyRef).onDestroy(() => {
      this.document.defaultView?.removeEventListener('focus', refresh);
      this.closeNotifications();
    });
  }

  get notificationsSupported(): boolean {
    return this.document.defaultView?.isSecureContext === true
      && typeof Notification !== 'undefined'
      && typeof Notification.requestPermission === 'function';
  }

  setDarkMode(enabled: boolean): void {
    this.dark.set(enabled);
    this.applyTheme();
    this.persist();
  }

  async setReminders(enabled: boolean): Promise<void> {
    const request = ++this.permissionRequest;
    if (!enabled) {
      this.requestingPermission.set(false);
      this.reminders.set(false);
      this.closeNotifications();
      this.notificationMessage.set('Reminder notifications are off.');
      this.persist();
      return;
    }
    if (!this.notificationsSupported) {
      this.refreshPermission();
      return;
    }
    this.requestingPermission.set(true);
    try {
      // This is called only from the toggle's user gesture, never at startup.
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission() : Notification.permission;
      if (request !== this.permissionRequest) return;
      this.reminders.set(permission === 'granted');
      this.notificationMessage.set(permission === 'granted'
        ? 'Reminder notifications are on. You can send a test below.'
        : permission === 'denied'
          ? 'Notifications are blocked. Allow them in your browser’s site settings, then turn Reminder on.'
          : 'Permission was not granted. Turn Reminder on to try again.');
      this.persist();
    } catch {
      if (request !== this.permissionRequest) return;
      this.reminders.set(false);
      this.notificationMessage.set('Notification permission could not be requested. Try again in a supported browser.');
      this.persist();
    } finally {
      if (request === this.permissionRequest) this.requestingPermission.set(false);
    }
  }

  refreshPermission(): void {
    if (!this.notificationsSupported || Notification.permission !== 'granted') {
      if (this.reminders()) {
        this.reminders.set(false);
        this.closeNotifications();
        this.persist();
      }
      this.notificationMessage.set(!this.notificationsSupported
        ? 'Notifications are unavailable here. Use a supported browser over HTTPS or localhost.'
        : Notification.permission === 'denied'
          ? 'Notifications are blocked. Allow them in your browser’s site settings, then turn Reminder on.'
          : 'Turn Reminder on to allow browser notifications.');
    } else {
      this.notificationMessage.set(this.reminders()
        ? 'Reminder notifications are on. You can send a test below.'
        : 'Reminder notifications are off.');
    }
  }

  sendTestNotification(): void {
    this.refreshPermission();
    if (!this.reminders()) return;
    try {
      const notification = new Notification('BalikPinas Planner', {
        body: 'Your reminder notifications are on. Have a wonderful trip!',
        tag: 'balikpinas-reminder-test'
      });
      this.activeNotifications.add(notification);
      notification.onclose = () => this.activeNotifications.delete(notification);
      this.notificationMessage.set('Test sent. If it does not appear, check your device’s notification settings.');
    } catch {
      this.reminders.set(false);
      this.persist();
      this.notificationMessage.set('This browser cannot display reminders while the app is open. Try a supported desktop browser.');
    }
  }

  private applyTheme(): void {
    this.document.documentElement.classList.toggle('ion-palette-dark', this.dark());
  }

  private closeNotifications(): void {
    this.activeNotifications.forEach(notification => notification.close());
    this.activeNotifications.clear();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        darkMode: this.dark(), remindersEnabled: this.reminders()
      }));
      this.storageMessage.set('');
    } catch {
      this.storageMessage.set('Settings could not be saved. Changes apply for this visit.');
    }
  }
}
