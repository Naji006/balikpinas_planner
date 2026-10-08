import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlannerStoreService } from '../planner-store.service';
import { TripsPage } from './trips.page';

const store = {
  load: vi.fn(() => Promise.resolve([])),
  getSelectedTrip: vi.fn(() => null)
};

describe('TripsPage', () => {
  let component: TripsPage;
  let fixture: ComponentFixture<TripsPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PlannerStoreService, useValue: store }]
    });
    fixture = TestBed.createComponent(TripsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should return a safe default weather summary when no forecast is loaded yet', () => {
    expect(component.getTripWeather({ ...component.newTrip, id: 1, destination: 'Manila, Philippines' })).toMatchObject({
      temperature: expect.any(Number),
      summary: expect.any(String),
      icon: expect.any(String)
    });
  });
});
