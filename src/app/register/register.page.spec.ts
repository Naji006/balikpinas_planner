import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterPage } from './register.page';
import { PlannerStoreService } from '../planner-store.service';

describe('RegisterPage', () => {
  let component: RegisterPage;
  let fixture: ComponentFixture<RegisterPage>;
  const store = {
    clearSession: vi.fn().mockResolvedValue(undefined),
    recordTransaction: vi.fn().mockResolvedValue(undefined),
    registerAccount: vi.fn().mockResolvedValue(true)
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PlannerStoreService, useValue: store }]
    });
    fixture = TestBed.createComponent(RegisterPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('clears the registration session before returning to login', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const callOrder: string[] = [];
    store.clearSession.mockImplementation(async () => { callOrder.push('clear'); });
    navigateSpy.mockImplementation(async () => {
      callOrder.push('navigate');
      return true;
    });

    await component.register();

    expect(store.registerAccount).toHaveBeenCalled();
    expect(store.recordTransaction).toHaveBeenCalled();
    expect(callOrder).toEqual(['clear', 'navigate']);
    expect(navigateSpy).toHaveBeenCalledWith('/login?registered=1');
  });
});
