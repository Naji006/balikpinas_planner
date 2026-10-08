import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SettingsService } from './settings.service';

const key = 'balikpinas:settings';

describe('SettingsService', () => {
  const close = vi.fn();
  const requestPermission = vi.fn();
  let permission: NotificationPermission;
  let notification: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    permission = 'default';
    requestPermission.mockReset();
    close.mockReset();
    notification = vi.fn(function () { return { close, onclose: null }; });
    Object.defineProperties(notification, {
      permission: { get: () => permission },
      requestPermission: { value: requestPermission }
    });
    vi.stubGlobal('Notification', notification);
    vi.stubGlobal('isSecureContext', true);
    document.documentElement.classList.remove('ion-palette-dark');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.classList.remove('ion-palette-dark');
  });

  it('applies a saved theme at startup and persists toggles without asking for permission', () => {
    localStorage.setItem(key, JSON.stringify({ darkMode: true, remindersEnabled: false }));
    const settings = TestBed.inject(SettingsService);
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
    settings.setDarkMode(false);
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(false);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ darkMode: false, remindersEnabled: false });
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('uses system appearance only when no boolean theme preference was saved', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    localStorage.setItem(key, JSON.stringify({ darkMode: 'false', remindersEnabled: 'true' }));
    const settings = TestBed.inject(SettingsService);
    expect(settings.darkMode()).toBe(true);
    expect(settings.remindersEnabled()).toBe(false);
  });

  it('handles corrupt and unavailable storage without preventing theme changes', () => {
    localStorage.setItem(key, '{broken');
    const settings = TestBed.inject(SettingsService);
    expect(settings.storageMessage()).not.toBe('');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    settings.setDarkMode(true);
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
    expect(settings.storageMessage()).toContain('could not be saved');
  });

  it('requires opt-in even with permission, sends a test, and closes it when disabled', async () => {
    permission = 'granted';
    const settings = TestBed.inject(SettingsService);
    settings.sendTestNotification();
    expect(notification).not.toHaveBeenCalled();
    await settings.setReminders(true);
    settings.sendTestNotification();
    expect(notification).toHaveBeenCalledWith('BalikPinas Planner', expect.objectContaining({ tag: 'balikpinas-reminder-test' }));
    await settings.setReminders(false);
    settings.sendTestNotification();
    expect(notification).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(key)!).remindersEnabled).toBe(false);
  });

  it.each(['denied', 'default'] as const)('keeps Reminder off after permission returns %s', async result => {
    requestPermission.mockResolvedValue(result);
    const settings = TestBed.inject(SettingsService);
    await settings.setReminders(true);
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(settings.remindersEnabled()).toBe(false);
    expect(settings.requestingPermission()).toBe(false);
    settings.sendTestNotification();
    expect(notification).not.toHaveBeenCalled();
  });

  it('persists granted permission and restores opt-in without prompting', async () => {
    requestPermission.mockImplementation(async () => { permission = 'granted'; return permission; });
    const settings = TestBed.inject(SettingsService);
    await settings.setReminders(true);
    expect(settings.remindersEnabled()).toBe(true);
    TestBed.resetTestingModule();
    expect(TestBed.inject(SettingsService).remindersEnabled()).toBe(true);
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('does not turn reminders back on when disabled during a permission request', async () => {
    let resolve!: (value: NotificationPermission) => void;
    requestPermission.mockReturnValue(new Promise<NotificationPermission>(done => { resolve = done; }));
    const settings = TestBed.inject(SettingsService);
    const pending = settings.setReminders(true);
    await settings.setReminders(false);
    permission = 'granted';
    resolve('granted');
    await pending;
    expect(settings.remindersEnabled()).toBe(false);
  });

  it('clears saved opt-in if permission is revoked outside the app', async () => {
    permission = 'granted';
    const settings = TestBed.inject(SettingsService);
    await settings.setReminders(true);
    permission = 'denied';
    window.dispatchEvent(new Event('focus'));
    expect(settings.remindersEnabled()).toBe(false);
    expect(settings.notificationMessage()).toContain('blocked');
    expect(JSON.parse(localStorage.getItem(key)!).remindersEnabled).toBe(false);
  });

  it('handles browsers without notifications and insecure contexts', async () => {
    vi.stubGlobal('Notification', undefined);
    const settings = TestBed.inject(SettingsService);
    await settings.setReminders(true);
    expect(settings.remindersEnabled()).toBe(false);
    expect(settings.notificationMessage()).toContain('unavailable');
    vi.stubGlobal('Notification', notification);
    vi.stubGlobal('isSecureContext', false);
    expect(settings.notificationsSupported).toBe(false);
  });

  it('reports permission request failures', async () => {
    requestPermission.mockRejectedValue(new Error('Permission API unavailable'));
    const settings = TestBed.inject(SettingsService);
    await settings.setReminders(true);
    expect(settings.remindersEnabled()).toBe(false);
    expect(settings.requestingPermission()).toBe(false);
    expect(settings.notificationMessage()).toContain('could not be requested');
  });

  it('reports browsers that cannot construct foreground notifications', async () => {
    permission = 'granted';
    notification.mockImplementation(function () { throw new TypeError('Use service worker'); });
    const settings = TestBed.inject(SettingsService);
    await settings.setReminders(true);
    settings.sendTestNotification();
    expect(settings.remindersEnabled()).toBe(false);
    expect(settings.notificationMessage()).toContain('cannot display');
  });
});
