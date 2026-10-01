import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { airplaneOutline, arrowBackOutline, calendarOutline, checkmarkCircleOutline, chevronForwardOutline, cloudOutline, locationOutline, walletOutline } from 'ionicons/icons';
import { PlannerStoreService } from '../planner-store.service';

interface ItineraryActivity {
  id: number;
  date: string;
  time: string;
  title: string;
  note: string;
}

@Component({
  selector: 'app-trip-details',
  templateUrl: './trip-details.page.html',
  styleUrls: ['./trip-details.page.scss'],
  standalone: false,
})
export class TripDetailsPage implements OnInit {
  activeSection = 'Overview';
  readonly sections = ['Overview', 'Flight', 'Itinerary', 'Budget'];
  showActivityForm = false;
  draftActivity = { date: '2026-12-20', time: '', title: '', note: '' };
  activities: ItineraryActivity[] = [
    { id: 1, date: '2026-12-20', time: '7:30 PM', title: 'Arrive at Dubai International Airport', note: 'Terminal 1 · Philippine Airlines check-in' },
    { id: 2, date: '2026-12-20', time: '10:30 PM', title: 'Flight PR 102 departs', note: 'DXB to Manila · Gate details pending' },
    { id: 3, date: '2026-12-21', time: '10:45 AM', title: 'Arrive in Manila', note: 'Ninoy Aquino International Airport' }
  ];

  constructor(private readonly router: Router, private readonly store: PlannerStoreService) {
    addIcons({ airplaneOutline, arrowBackOutline, calendarOutline, checkmarkCircleOutline, chevronForwardOutline, cloudOutline, locationOutline, walletOutline });
  }

  async ngOnInit(): Promise<void> {
    this.activities = await this.store.load('itinerary', this.activities);
  }

  goBack(): void {
    void this.router.navigateByUrl('/tabs/trips');
  }

  async addActivity(): Promise<void> {
    if (!this.draftActivity.title.trim()) return;
    this.activities = [...this.activities, { id: Date.now(), ...this.draftActivity, title: this.draftActivity.title.trim() }];
    await this.store.save('itinerary', this.activities);
    this.draftActivity = { date: '2026-12-20', time: '', title: '', note: '' };
    this.showActivityForm = false;
  }

  async removeActivity(id: number): Promise<void> {
    this.activities = this.activities.filter(activity => activity.id !== id);
    await this.store.save('itinerary', this.activities);
  }
}
