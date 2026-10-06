import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { PlannerStoreService } from '../planner-store.service';
import { PasswordRecoveryPage } from './password-recovery.page';

describe('PasswordRecoveryPage', () => {
  let fixture: ComponentFixture<PasswordRecoveryPage>;
  let component: PasswordRecoveryPage;
  const snapshot = { data: { reset: false }, fragment: '' };
  const store = { requestPasswordReset: vi.fn(), resetPassword: vi.fn() };
  const token = 'a'.repeat(43);

  function create(reset = false, fragment = ''): void {
    snapshot.data.reset = reset;
    snapshot.fragment = fragment;
    fixture = TestBed.createComponent(PasswordRecoveryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [PasswordRecoveryPage],
      providers: [provideRouter([]), { provide: PlannerStoreService, useValue: store },
        { provide: ActivatedRoute, useValue: { snapshot } }]
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  it('shows the generic confirmation after requesting a reset', async () => {
    create();
    store.requestPasswordReset.mockResolvedValueOnce({ message: 'If an account exists, a link will be sent.' });
    component.email = 'traveler@example.com';
    await component.submit();
    fixture.detectChanges();
    expect(store.requestPasswordReset).toHaveBeenCalledWith('traveler@example.com');
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('If an account exists');
    expect(component.pending).toBe(false);
  });

  it('takes the token from the fragment, clears the URL and returns to login after reset', async () => {
    create(true, `token=${token}`);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([], expect.objectContaining({ fragment: '', replaceUrl: true }));
    store.resetPassword.mockResolvedValueOnce(undefined);
    component.password = 'new-password';
    component.confirmPassword = 'new-password';
    await component.submit();
    expect(store.resetPassword).toHaveBeenCalledWith(token, 'new-password');
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/login?passwordReset=1');
    expect(component.password).toBe('');
  });

  it('rejects invalid links, mismatched passwords and passwords exceeding bcrypt limits', async () => {
    create(true);
    await component.submit();
    expect(store.resetPassword).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('invalid');
    fixture.destroy();
    create(true, `token=${token}`);
    component.password = 'new-password';
    component.confirmPassword = 'different-password';
    await component.submit();
    expect(component.error).toBe('Passwords do not match.');
    component.password = component.confirmPassword = 'é'.repeat(40);
    await component.submit();
    expect(component.error).toContain('72 UTF-8 bytes');
    expect(store.resetPassword).not.toHaveBeenCalled();
  });

  it('shows an expired-link error returned by the API', async () => {
    create(true, `token=${token}`);
    store.resetPassword.mockRejectedValueOnce(new HttpErrorResponse({ status: 400, error: { error: 'This reset link has expired.' } }));
    component.password = component.confirmPassword = 'new-password';
    await component.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('expired');
    expect(component.pending).toBe(false);
  });
});
