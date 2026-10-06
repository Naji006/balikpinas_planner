import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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

interface TripWeatherState {
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
}

interface GeoLocationResponse {
  results?: Array<{ latitude?: number; longitude?: number; name?: string; country?: string; admin1?: string }>;
}

interface WeatherApiResponse {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
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
  tripId = 0;
  tripOriginAirport = 'DXB · Dubai International Airport';
  tripDestinationAirport = 'MNL · Ninoy Aquino International Airport';
  tripAirline = 'Philippine Airlines';
  tripTerminal = 'Terminal 1';
  tripBookingReference = 'PAL-2026-7842';
  tripHotel = 'The Grand Hotel Manila';
  tripTravelers = 2;
  tripDestination = 'Manila, Philippines';
  tripStartDate = '2026-12-20';
  tripEndDate = '2027-01-10';
  tripFlight = 'PR 102';
  temperature = 32;
  descriptionText = 'Mostly sunny';
  weatherIcon = 'sunny-outline';
  humidity = 68;
  windSpeed = 10;
  loadingWeather = false;
  activities: ItineraryActivity[] = [
    { id: 1, date: '2026-12-20', time: '7:30 PM', title: 'Arrive at Dubai International Airport', note: 'Terminal 1 · Philippine Airlines check-in' },
    { id: 2, date: '2026-12-20', time: '10:30 PM', title: 'Flight PR 102 departs', note: 'DXB to Manila · Gate details pending' },
    { id: 3, date: '2026-12-21', time: '10:45 AM', title: 'Arrive in Manila', note: 'Ninoy Aquino International Airport' }
  ];

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly store: PlannerStoreService
  ) {
    addIcons({ airplaneOutline, arrowBackOutline, calendarOutline, checkmarkCircleOutline, chevronForwardOutline, cloudOutline, locationOutline, walletOutline });
  }

  async ngOnInit(): Promise<void> {
    this.activities = await this.store.load('itinerary', this.activities);

    const selectedTrip = this.store.getSelectedTrip();
    if (selectedTrip) {
      this.tripId = selectedTrip.id;
      this.tripDestination = selectedTrip.destination;
      this.tripOriginAirport = selectedTrip.originAirport ?? this.tripOriginAirport;
      this.tripDestinationAirport = selectedTrip.destinationAirport ?? this.tripDestinationAirport;
      this.tripAirline = selectedTrip.airline ?? this.tripAirline;
      this.tripTerminal = selectedTrip.terminal ?? this.tripTerminal;
      this.tripBookingReference = selectedTrip.bookingReference ?? this.tripBookingReference;
      this.tripHotel = selectedTrip.hotel ?? this.tripHotel;
      this.tripTravelers = selectedTrip.travelers ?? this.tripTravelers;
      this.tripStartDate = selectedTrip.startDate;
      this.tripEndDate = selectedTrip.endDate;
      this.tripFlight = selectedTrip.flight;
    }

    const routeTripId = Number(this.route.snapshot.queryParamMap.get('id') ?? '0');
    this.tripId = routeTripId || this.tripId;
    this.tripDestination = this.route.snapshot.queryParamMap.get('destination') ?? this.tripDestination;
    this.tripOriginAirport = this.route.snapshot.queryParamMap.get('originAirport') ?? this.tripOriginAirport;
    this.tripDestinationAirport = this.route.snapshot.queryParamMap.get('destinationAirport') ?? this.tripDestinationAirport;
    this.tripAirline = this.route.snapshot.queryParamMap.get('airline') ?? this.tripAirline;
    this.tripTerminal = this.route.snapshot.queryParamMap.get('terminal') ?? this.tripTerminal;
    this.tripBookingReference = this.route.snapshot.queryParamMap.get('bookingReference') ?? this.tripBookingReference;
    this.tripHotel = this.route.snapshot.queryParamMap.get('hotel') ?? this.tripHotel;
    this.tripTravelers = Number(this.route.snapshot.queryParamMap.get('travelers') ?? this.tripTravelers);
    this.tripStartDate = this.route.snapshot.queryParamMap.get('startDate') ?? this.tripStartDate;
    this.tripEndDate = this.route.snapshot.queryParamMap.get('endDate') ?? this.tripEndDate;
    this.tripFlight = this.route.snapshot.queryParamMap.get('flight') ?? this.tripFlight;

    if (this.tripDestination && this.tripStartDate && this.tripEndDate && this.tripFlight) {
      this.store.setSelectedTrip({
        id: this.tripId || Date.now(),
        destination: this.tripDestination,
        originAirport: this.tripOriginAirport,
        destinationAirport: this.tripDestinationAirport,
        airline: this.tripAirline,
        terminal: this.tripTerminal,
        bookingReference: this.tripBookingReference,
        hotel: this.tripHotel,
        travelers: this.tripTravelers,
        startDate: this.tripStartDate,
        endDate: this.tripEndDate,
        flight: this.tripFlight
      });
    }

    await this.loadTripWeather();
  }

  async loadTripWeather(): Promise<void> {
    this.loadingWeather = true;
    try {
      const weather = await this.fetchDestinationWeather(this.tripDestination);
      if (weather) {
        this.temperature = weather.temperature;
        this.descriptionText = weather.description;
        this.weatherIcon = weather.icon;
        this.humidity = weather.humidity;
        this.windSpeed = weather.windSpeed;
      }
    } finally {
      this.loadingWeather = false;
    }
  }

  private async fetchDestinationWeather(destination: string): Promise<TripWeatherState | null> {
    try {
      const city = destination.split(',')[0].trim();
      const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
      if (!geoResponse.ok) return null;
      const geoData = await geoResponse.json() as GeoLocationResponse;
      const result = geoData.results?.[0];
      if (!result || result.latitude == null || result.longitude == null) return null;

      const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&timezone=Asia%2FManila&forecast_days=1`);
      if (!weatherResponse.ok) return null;
      const weatherData = await weatherResponse.json() as WeatherApiResponse;
      const code = weatherData.current?.weather_code ?? 1;

      return {
        temperature: Math.round(weatherData.current?.temperature_2m ?? 30),
        description: this.description(code),
        icon: this.icon(code),
        humidity: weatherData.current?.relative_humidity_2m ?? 68,
        windSpeed: Math.round(weatherData.current?.wind_speed_10m ?? 10)
      };
    } catch {
      return null;
    }
  }

  routeCode(airport: string): string {
    const match = airport.match(/\b[A-Z]{3}\b/);
    return match ? match[0] : 'N/A';
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
