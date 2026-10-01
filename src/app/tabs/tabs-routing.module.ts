import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadChildren: () =>
          import('../home/home.module').then(m => m.HomePageModule)
      },
      {
        path: 'trips',
        loadChildren: () =>
          import('../trips/trips.module').then(m => m.TripsPageModule)
      },
      {
        path: 'trip-details',
        loadChildren: () =>
          import('../trip-details/trip-details.module').then(m => m.TripDetailsPageModule)
      },
      {
        path: 'documents',
        loadChildren: () =>
          import('../documents/documents.module').then(m => m.DocumentsPageModule)
      },
      {
        path: 'budget',
        loadChildren: () =>
          import('../budget/budget.module').then(m => m.BudgetPageModule)
      },
      {
        path: 'weather',
        loadChildren: () =>
          import('../weather/weather.module').then(m => m.WeatherPageModule)
      },
      {
        path: 'checklist',
        loadChildren: () =>
          import('../checklist/checklist.module').then(m => m.ChecklistPageModule)
      },
      {
        path: 'contacts',
        loadChildren: () =>
          import('../contacts/contacts.module').then(m => m.ContactsPageModule)
      },
      {
        path: 'profile',
        loadChildren: () =>
          import('../profile/profile.module').then(m => m.ProfilePageModule)
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('../settings/settings.module').then(m => m.SettingsPageModule)
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsPageRoutingModule {}
