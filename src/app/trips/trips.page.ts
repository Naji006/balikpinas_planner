import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { addOutline, airplaneOutline, calendarOutline, chevronForwardOutline, locationOutline, trashOutline } from 'ionicons/icons';
import { PlannerStoreService } from '../planner-store.service';

interface TripPlan {
  id: number;
  destination: string;
  startDate: string;
  endDate: string;
  flight: string;
}

@Component({
  selector: 'app-trips',
  templateUrl: './trips.page.html',
  styleUrls: ['./trips.page.scss'],
  standalone: false,
})
export class TripsPage implements OnInit {
  showTripForm = false;
  trips: TripPlan[] = [{
    id: 1,
    destination: 'Manila, Philippines',
    startDate: '2026-12-20',
    endDate: '2027-01-10',
    flight: 'PR 102'
  }];
  newTrip = { destination: '', startDate: '', endDate: '' };

  constructor(private readonly router: Router, private readonly store: PlannerStoreService) {
    addIcons({ addOutline, airplaneOutline, calendarOutline, chevronForwardOutline, locationOutline, trashOutline });
  }

  async ngOnInit(): Promise<void> {
    this.trips = await this.store.load('trips', this.trips);
  }

  async addTrip(): Promise<void> {
    const trip: TripPlan = {
      id: Date.now(),
      ...this.newTrip,
      flight: 'To be confirmed'
    };
    this.trips = [trip, ...this.trips];
    await this.store.save('trips', this.trips);
    await this.store.recordTransaction({
      action: 'trip-created',
      description: trip.destination,
      createdAt: new Date().toISOString()
    });
    this.newTrip = { destination: '', startDate: '', endDate: '' };
    this.showTripForm = false;
  }

  openDetails(): void {
    void this.router.navigateByUrl('/tabs/trip-details');
  }

  async removeTrip(id: number): Promise<void> {
    this.trips = this.trips.filter(trip => trip.id !== id);
    await this.store.save('trips', this.trips);
  }
}
