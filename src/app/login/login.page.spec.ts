import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { LoginPage } from './login.page';
import { PlannerStoreService } from '../planner-store.service';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  const registeredUser = {
    email: 'maria.demo@example.com',
    fullName: 'Maria Santos',
    phone: '09170000001'
  };
  const store = {
    authenticateUser: vi.fn().mockResolvedValue(registeredUser),
    recordTransaction: vi.fn().mockResolvedValue(undefined),
    setSession: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store.authenticateUser.mockResolvedValue(registeredUser);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PlannerStoreService, useValue: store }]
    });
    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('rejects credentials that do not match a registered account', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    component.email = 'demo@example.com';
    component.password = 'not-recorded';
    store.authenticateUser.mockResolvedValueOnce(null);

    await component.login();

    expect(component.loginError).toBe('Email or password is incorrect.');
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(store.recordTransaction).not.toHaveBeenCalled();
  });

  it('records a successful registered login without saving the password', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    component.email = registeredUser.email;
    component.password = 'not-recorded';

    await component.login();

    expect(store.recordTransaction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'login',
      email: registeredUser.email
    }));
    expect(JSON.stringify(store.recordTransaction.mock.calls)).not.toContain('not-recorded');
    expect(store.setSession).toHaveBeenCalledWith(registeredUser);
    expect(navigateSpy).toHaveBeenCalledWith('/tabs/home');
  });
});
