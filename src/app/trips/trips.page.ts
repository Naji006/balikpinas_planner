import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { addOutline, airplaneOutline, calendarOutline, chevronForwardOutline, locationOutline, trashOutline } from 'ionicons/icons';
import { PlannerStoreService } from '../planner-store.service';

interface TripPlan {
  id: number;
  destination: string;
  originAirport: string;
  destinationAirport: string;
  airline: string;
  terminal: string;
  bookingReference: string;
  hotel: string;
  travelers: number;
  startDate: string;
  endDate: string;
  flight: string;
}

interface TripWeatherSummary {
  summary: string;
  temperature: number;
  icon: string;
}

interface LocationLookupResponse {
  results?: Array<{ name?: string; latitude?: number; longitude?: number; country?: string }>; 
}

interface ForecastApiResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
  };
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
    originAirport: 'DXB · Dubai International Airport',
    destinationAirport: 'MNL · Ninoy Aquino International Airport',
    airline: 'Philippine Airlines',
    terminal: 'Terminal 1',
    bookingReference: 'PAL-2026-7842',
    hotel: 'The Grand Hotel Manila',
    travelers: 2,
    startDate: '2026-12-20',
    endDate: '2027-01-10',
    flight: 'PR 102'
  }];
  newTrip = { destination: '', originAirport: '', destinationAirport: '', airline: '', flight: '', terminal: '', bookingReference: '', hotel: '', travelers: 1, startDate: '', endDate: '' };
  private readonly tripWeather = new Map<number, TripWeatherSummary>();

  constructor(private readonly router: Router, private readonly store: PlannerStoreService) {
    addIcons({ addOutline, airplaneOutline, calendarOutline, chevronForwardOutline, locationOutline, trashOutline });
  }

  async ngOnInit(): Promise<void> {
    this.trips = await this.store.load('trips', this.trips);
    const selectedTrip = this.store.getSelectedTrip();
    if (selectedTrip) {
      const hasTrip = this.trips.some(trip => trip.id === selectedTrip.id);
      if (!hasTrip) {
        this.store.setSelectedTrip(null);
      }
    }
    await this.loadTripWeatherForAll();
  }

  getTripWeather(trip: TripPlan): TripWeatherSummary {
    return this.tripWeather.get(trip.id) ?? {
      summary: 'Mostly sunny',
      temperature: 30,
      icon: 'sunny-outline'
    };
  }

  async loadTripWeatherForAll(): Promise<void> {
    for (const trip of this.trips) {
      const weather = await this.fetchDestinationWeather(trip.destination);
      if (weather) {
        this.tripWeather.set(trip.id, weather);
      }
    }
  }

  private async fetchDestinationWeather(destination: string): Promise<TripWeatherSummary | null> {
    try {
      const city = destination.split(',')[0].trim();
      const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
      if (!geoResponse.ok) return null;
      const geoData = await geoResponse.json() as LocationLookupResponse;
      const result = geoData.results?.[0];
      if (!result || result.latitude == null || result.longitude == null) return null;

      const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&current=temperature_2m,weather_code&timezone=Asia%2FManila&forecast_days=1`);
      if (!weatherResponse.ok) return null;
      const weatherData = await weatherResponse.json() as ForecastApiResponse;
      const code = weatherData.current?.weather_code ?? 1;
      const temperature = Math.round(weatherData.current?.temperature_2m ?? 30);

      return {
        summary: this.description(code),
        temperature,
        icon: this.icon(code)
      };
    } catch {
      return null;
    }
  }

  description(code: number): string {
    if (code >= 95) return 'Thunderstorms';
    if (code >= 51) return 'Rain showers';
    if (code >= 3) return 'Cloudy';
    if (code === 2) return 'Partly cloudy';
    return 'Mostly sunny';
  }

  icon(code: number): string {
    if (code >= 95) return 'thunderstorm-outline';
    if (code >= 51) return 'rainy-outline';
    if (code >= 3) return 'cloudy-outline';
    return 'sunny-outline';
  }

  async addTrip(): Promise<void> {
    const trip: TripPlan = {
      id: Date.now(),
      destination: this.newTrip.destination,
      originAirport: this.newTrip.originAirport,
      destinationAirport: this.newTrip.destinationAirport,
      airline: this.newTrip.airline || 'To be confirmed',
      terminal: this.newTrip.terminal || 'To be confirmed',
      bookingReference: this.newTrip.bookingReference || 'Pending',
      hotel: this.newTrip.hotel || 'To be confirmed',
      travelers: this.newTrip.travelers || 1,
      startDate: this.newTrip.startDate,
      endDate: this.newTrip.endDate,
      flight: this.newTrip.flight || 'To be confirmed'
    };
    this.trips = [trip, ...this.trips];
    await this.store.save('trips', this.trips);
    await this.store.recordTransaction({
      action: 'trip-created',
      description: trip.destination,
      createdAt: new Date().toISOString()
    });
    this.newTrip = { destination: '', originAirport: '', destinationAirport: '', airline: '', flight: '', terminal: '', bookingReference: '', hotel: '', travelers: 1, startDate: '', endDate: '' };
    this.showTripForm = false;
  }

  openDetails(trip: TripPlan): void {
    this.store.setSelectedTrip(trip);
    void this.router.navigate(['/tabs/trip-details'], {
      queryParams: {
        id: trip.id,
        destination: trip.destination,
        originAirport: trip.originAirport,
        destinationAirport: trip.destinationAirport,
        airline: trip.airline,
        terminal: trip.terminal,
        bookingReference: trip.bookingReference,
        hotel: trip.hotel,
        travelers: trip.travelers,
        startDate: trip.startDate,
        endDate: trip.endDate,
        flight: trip.flight
      }
    });
  }

  async removeTrip(id: number): Promise<void> {
    const selectedTrip = this.store.getSelectedTrip();
    if (selectedTrip?.id === id) {
      this.store.setSelectedTrip(null);
    }
    this.trips = this.trips.filter(trip => trip.id !== id);
    await this.store.save('trips', this.trips);
  }
}
