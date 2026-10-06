import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlannerStoreService } from './planner-store.service';

describe('PlannerStoreService', () => {
  let store: PlannerStoreService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [PlannerStoreService, provideHttpClient(), provideHttpClientTesting()]
    });
    store = TestBed.inject(PlannerStoreService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses fallback data only when a collection is empty', async () => {
    const fallback = [{ id: 1 }];
    const result = store.load('trips', fallback);
    http.expectOne('/api/collections/trips').flush({ value: null });

    await expect(result).resolves.toEqual(fallback);
  });

  it('loads cached data offline and syncs queued changes when online', async () => {
    const firstLoad = store.load('trips', []);
    http.expectOne('/api/collections/trips').flush({ value: [{ id: 1 }] });
    await expect(firstLoad).resolves.toEqual([{ id: 1 }]);

    const offlineLoad = store.load('trips', []);
    http.expectOne('/api/collections/trips').flush(
      { error: 'offline' },
      { status: 0, statusText: 'Unknown Error' }
    );
    await expect(offlineLoad).resolves.toEqual([{ id: 1 }]);

    const update = [{ id: 2 }];
    const offlineSave = store.save('trips', update);
    http.expectOne('/api/collections/trips').flush(
      { error: 'offline' },
      { status: 0, statusText: 'Unknown Error' }
    );
    await expect(offlineSave).resolves.toBeUndefined();

    const reconnectLoad = store.load('trips', []);
    http.expectOne('/api/collections/trips').flush(null, { status: 204, statusText: 'No Content' });
    await expect(reconnectLoad).resolves.toEqual(update);
  });

  it('restores a previously signed-in session when the API is offline', async () => {
    const user = { email: 'traveler@example.com', fullName: 'Traveler', phone: '' };
    localStorage.setItem('balikpinas:last-session', JSON.stringify(user));

    const session = store.getSession();
    http.expectOne('/api/auth/me').flush(
      { error: 'offline' },
      { status: 0, statusText: 'Unknown Error' }
    );

    await expect(session).resolves.toEqual(user);
  });

  it('authenticates through the API with session cookies enabled', async () => {
    const user = { email: 'traveler@example.com', fullName: 'Traveler', phone: '' };
    const login = store.authenticateUser(user.email, 'example-password');
    const request = http.expectOne('/api/auth/login');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: user.email, password: 'example-password' });
    expect(request.request.withCredentials).toBe(true);
    request.flush(user);

    await expect(login).resolves.toEqual(user);
  });

  it('requests a password reset through the API without storing credentials', async () => {
    const reset = store.requestPasswordReset('traveler@example.com');
    const request = http.expectOne('/api/auth/forgot-password');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'traveler@example.com' });
    expect(request.request.withCredentials).toBe(true);
    request.flush({ message: 'Check your email' });
    await expect(reset).resolves.toEqual({ message: 'Check your email' });
    expect(localStorage.length).toBe(0);
  });

  it('clears the cached session after a successful password reset', async () => {
    store.setSession({ email: 'traveler@example.com', fullName: 'Traveler', phone: '' });
    const reset = store.resetPassword('reset-token', 'new-password');
    const request = http.expectOne('/api/auth/reset-password');
    expect(request.request.body).toEqual({ token: 'reset-token', password: 'new-password' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await expect(reset).resolves.toBeUndefined();
    expect(localStorage.getItem('balikpinas:last-session')).toBeNull();
  });

  it('does not accept a cached session as proof of Google sign-in', async () => {
    store.setSession({ email: 'cached@example.com', fullName: 'Cached', phone: '' });
    const completion = store.completeGoogleSignIn();
    http.expectOne('/api/auth/me').flush(null, { status: 0, statusText: 'Offline' });
    await expect(completion).rejects.toMatchObject({ status: 0 });
  });

  it('starts Google sign-in with cookies and caches the confirmed account', async () => {
    const start = store.googleSignInUrl();
    const request = http.expectOne('/api/auth/google/start');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ url: 'https://accounts.google.com/' });
    await expect(start).resolves.toBe('https://accounts.google.com/');
    const user = { email: 'google@example.com', fullName: 'Google Traveler', phone: '' };
    const completion = store.completeGoogleSignIn();
    http.expectOne('/api/auth/me').flush(user);
    await expect(completion).resolves.toEqual(user);
    expect(JSON.parse(localStorage.getItem('balikpinas:last-session') || '{}')).toEqual(user);
  });
});
