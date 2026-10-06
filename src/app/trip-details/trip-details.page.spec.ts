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

  it('should map weather codes to readable labels and icons', () => {
    expect(component.description(2)).toBe('Partly cloudy');
    expect(component.description(61)).toBe('Rain showers');
    expect(component.icon(95)).toBe('thunderstorm-outline');
  });
});
