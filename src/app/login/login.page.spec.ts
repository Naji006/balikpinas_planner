import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { LoginPage } from './login.page';
import { PlannerStoreService } from '../planner-store.service';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const registeredUser = {
    email: 'maria.demo@example.com',
    fullName: 'Maria Santos',
    phone: '09170000001'
  };
  const store = {
    authenticateUser: vi.fn().mockResolvedValue(registeredUser),
    getSession: vi.fn().mockResolvedValue(null),
    recordTransaction: vi.fn().mockResolvedValue(undefined),
    googleSignInUrl: vi.fn(),
    completeGoogleSignIn: vi.fn().mockResolvedValue(registeredUser),
    setSession: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store.authenticateUser.mockResolvedValue(registeredUser);
    store.getSession.mockResolvedValue(null);
    queryParams = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PlannerStoreService, useValue: store },
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParams.asObservable() } }]
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

  it('shows a service error when authentication cannot reach the API', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    store.authenticateUser.mockRejectedValueOnce(new Error('API unavailable'));

    await component.login();

    expect(component.loginError).toBe('Unable to reach the sign-in service. Please try again later.');
    expect(store.setSession).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
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

  it('does not block a successful login when activity logging fails', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    store.recordTransaction.mockRejectedValueOnce(new Error('Activity service unavailable'));

    await component.login();

    expect(component.loginError).toBe('');
    expect(store.setSession).toHaveBeenCalledWith(registeredUser);
    expect(navigateSpy).toHaveBeenCalledWith('/tabs/home');
  });

  it('shows an actionable error when Google sign-in is unavailable', async () => {
    store.googleSignInUrl.mockRejectedValueOnce(new Error('Not configured'));
    await component.continueWithGoogle();
    expect(component.loginError).toBe('Google sign-in is unavailable. Please try again later.');
    expect(component.googlePending).toBe(false);
  });

  it('confirms a successful Google callback before navigating to the planner', async () => {
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    queryParams.next(convertToParamMap({ google: 'success' }));
    component.ngOnInit();
    await vi.waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/tabs/home'));
    expect(store.completeGoogleSignIn).toHaveBeenCalled();
    expect(store.recordTransaction).toHaveBeenCalledWith(expect.objectContaining({ description: 'Successful Google sign-in' }));
  });

  it('stays on login when a Google callback cannot confirm its server session', async () => {
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    store.completeGoogleSignIn.mockRejectedValueOnce(new Error('No server session'));
    queryParams.next(convertToParamMap({ google: 'success' }));
    component.ngOnInit();
    await vi.waitFor(() => expect(component.loginError).toBe('Unable to confirm Google sign-in. Please try again.'));
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
