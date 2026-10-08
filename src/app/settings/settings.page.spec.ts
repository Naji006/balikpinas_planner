import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { SettingsService } from '../settings.service';
import { SettingsPage } from './settings.page';

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let settings: SettingsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(SettingsPage);
    settings = TestBed.inject(SettingsService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('ion-palette-dark');
  });

  it('wires both toggles and restores the switch when permission is not granted', async () => {
    const theme = vi.spyOn(settings, 'setDarkMode');
    const reminders = vi.spyOn(settings, 'setReminders').mockResolvedValue();
    const toggles = fixture.nativeElement.querySelectorAll('ion-toggle');
    toggles[0].dispatchEvent(new CustomEvent('ionChange', { detail: { checked: true } }));
    toggles[1].checked = true;
    toggles[1].dispatchEvent(new CustomEvent('ionChange', { detail: { checked: true } }));
    await fixture.whenStable();
    expect(toggles[1].checked).toBe(false);
    expect(theme).toHaveBeenCalledWith(true);
    expect(reminders).toHaveBeenCalledWith(true);
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
  });

  it('refreshes permission on return to the cached Ionic page', () => {
    const refresh = vi.spyOn(settings, 'refreshPermission');
    fixture.componentInstance.ionViewWillEnter();
    expect(refresh).toHaveBeenCalled();
  });
});
