import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { PlannerStoreService } from '../planner-store.service';
import { ChecklistPage } from './checklist.page';

const store = {
  load: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback))
};

describe('ChecklistPage', () => {
  let component: ChecklistPage;
  let fixture: ComponentFixture<ChecklistPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PlannerStoreService, useValue: store }]
    });
    fixture = TestBed.createComponent(ChecklistPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
