import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { PlannerStoreService } from '../planner-store.service';
import { TripDetailsPage } from './trip-details.page';

const store = {
  load: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback))
};

describe('TripDetailsPage', () => {
  let component: TripDetailsPage;
  let fixture: ComponentFixture<TripDetailsPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PlannerStoreService, useValue: store }]
    });
    fixture = TestBed.createComponent(TripDetailsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
