import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PlannerStoreService } from '../planner-store.service';

import { addIcons } from 'ionicons';
import {
  menuOutline,
  notificationsOutline,
  airplaneOutline,
  chevronForwardOutline,
  sunnyOutline,
  walletOutline,
  documentTextOutline,
  listOutline,
  peopleOutline,
  closeOutline,
  homeOutline,
  cloudOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit {
  private readonly router = inject(Router);
  private readonly store = inject(PlannerStoreService);
  currentUser = { fullName: 'Traveler', email: '', phone: '' };

  menuOpen = false;

  constructor() {

    addIcons({
      menuOutline,
      notificationsOutline,
      airplaneOutline,
      chevronForwardOutline,
      sunnyOutline,
      walletOutline,
      documentTextOutline,
      listOutline,
      peopleOutline,
      closeOutline,
      homeOutline,
      cloudOutline
    });

  }

  async ngOnInit(): Promise<void> {
    this.currentUser = await this.store.getSession() ?? this.currentUser;
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  openPage(page: string) {
    this.menuOpen = false;
    if (page === '/login') void this.store.clearSession().catch(() => undefined);
    const target = page === '/login' ? page : `/tabs${page}`;
    void this.router.navigateByUrl(target);
  }

}