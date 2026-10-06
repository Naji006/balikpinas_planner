import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { registeredUserGuard } from './registered-user.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  {
    path: 'login',
    loadChildren: () =>
      import('./login/login.module').then(m => m.LoginPageModule)
  },

  {
    path: 'register',
    loadChildren: () =>
      import('./register/register.module').then(m => m.RegisterPageModule)
  },

  {
    path: 'forgot-password',
    loadComponent: () => import('./password-recovery/password-recovery.page').then(m => m.PasswordRecoveryPage),
    data: { reset: false }
  },

  {
    path: 'reset-password',
    loadComponent: () => import('./password-recovery/password-recovery.page').then(m => m.PasswordRecoveryPage),
    data: { reset: true }
  },

  {
    path: 'tabs',
    canActivate: [registeredUserGuard],
    loadChildren: () =>
      import('./tabs/tabs.module').then(m => m.TabsPageModule)
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
