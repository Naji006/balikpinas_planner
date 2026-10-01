import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlannerStoreService } from './planner-store.service';

describe('PlannerStoreService', () => {
  let store: PlannerStoreService;
  let http: HttpTestingController;

  beforeEach(() => {
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
    http.expectOne('http://localhost:3000/api/collections/trips').flush({ value: null });

    await expect(result).resolves.toEqual(fallback);
  });

  it('does not allow writes after a failed collection read', async () => {
    const result = expect(store.load('trips', [])).rejects.toThrow();
    http.expectOne('http://localhost:3000/api/collections/trips').flush(
      { error: 'unavailable' },
      { status: 503, statusText: 'Service Unavailable' }
    );
    await result;

    await expect(store.save('trips', [])).rejects.toThrow('Cannot save trips before it has loaded successfully');
    http.expectNone(request => request.method === 'PUT');
  });
});