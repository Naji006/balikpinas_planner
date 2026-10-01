import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { PlannerStoreService } from '../planner-store.service';
import { BudgetPage } from './budget.page';

const store = {
  load: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback))
};

describe('BudgetPage', () => {
  let component: BudgetPage;
  let fixture: ComponentFixture<BudgetPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PlannerStoreService, useValue: store }]
    });
    fixture = TestBed.createComponent(BudgetPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
