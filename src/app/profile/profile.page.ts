import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { addIcons } from 'ionicons';
import { arrowBackOutline, personCircleOutline, timeOutline } from 'ionicons/icons';
import { PlannerStoreService, PlannerTransaction } from '../planner-store.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit {
  private readonly store = inject(PlannerStoreService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  currentUser = { fullName: 'Traveler', email: '', phone: '' };
  transactions: PlannerTransaction[] = [];
  loadingHistory = true;
  historyError = false;

  constructor() {
    addIcons({ arrowBackOutline, personCircleOutline, timeOutline });
  }

  async ngOnInit(): Promise<void> {
    try {
      const [user, transactions] = await Promise.all([this.store.getSession(), this.store.getTransactions()]);
      this.currentUser = user ?? this.currentUser;
      this.transactions = transactions.sort((first, second) =>
        second.createdAt.localeCompare(first.createdAt)
      ).slice(0, 20);
    } catch {
      this.historyError = true;
    } finally {
      this.loadingHistory = false;
      this.changeDetector.markForCheck();
    }
  }
}
