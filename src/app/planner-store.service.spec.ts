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
});