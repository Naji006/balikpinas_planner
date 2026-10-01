import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PlannerStoreService } from './planner-store.service';

export const registeredUserGuard: CanActivateFn = async () => {
  const store = inject(PlannerStoreService);
  const router = inject(Router);
  return await store.getSession() ? true : router.parseUrl('/login');
};