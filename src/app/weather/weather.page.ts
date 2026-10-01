import { Component, OnInit } from '@angular/core';
import { addIcons } from 'ionicons';
import { calendarOutline, cloudyOutline, locationOutline, refreshOutline, rainyOutline, speedometerOutline, sunnyOutline, thunderstormOutline, waterOutline } from 'ionicons/icons';

interface ForecastDay {
  date: string;
  high: number;
  low: number;
  code: number;
}

interface ManilaForecastResponse {
  current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; wind_speed_10m: number; weather_code: number };
  daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[] };
}

@Component({
  selector: 'app-weather',
  templateUrl: './weather.page.html',
  styleUrls: ['./weather.page.scss'],
  standalone: false,
})
export class WeatherPage implements OnInit {
  temperature = 32;
  feelsLike = 35;
  humidity = 68;
  windSpeed = 10;
  weatherCode = 2;
  loading = false;
  updatedAt = '';
  forecast: ForecastDay[] = [];

  constructor() {
    addIcons({ calendarOutline, cloudyOutline, locationOutline, refreshOutline, rainyOutline, speedometerOutline, sunnyOutline, thunderstormOutline, waterOutline });
  }

  ngOnInit(): void {
    void this.refreshForecast();
  }

  async refreshForecast(): Promise<void> {
    this.loading = true;
    try {
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=14.5995&longitude=120.9842&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FManila&forecast_days=5');
      if (!response.ok) throw new Error('Weather service unavailable');
      const data = await response.json() as ManilaForecastResponse;
      this.temperature = Math.round(data.current.temperature_2m);
      this.feelsLike = Math.round(data.current.apparent_temperature);
      this.humidity = data.current.relative_humidity_2m;
      this.windSpeed = Math.round(data.current.wind_speed_10m);
      this.weatherCode = data.current.weather_code;
      this.forecast = data.daily.time.map((date, index) => ({
        date,
        high: Math.round(data.daily.temperature_2m_max[index]),
        low: Math.round(data.daily.temperature_2m_min[index]),
        code: data.daily.weather_code[index]
      }));
      this.updatedAt = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(new Date());
    } catch {
      this.forecast = [
        { date: '2026-10-01', high: 32, low: 25, code: 2 },
        { date: '2026-10-02', high: 31, low: 25, code: 3 },
        { date: '2026-10-03', high: 30, low: 24, code: 61 },
        { date: '2026-10-04', high: 31, low: 25, code: 2 },
        { date: '2026-10-05', high: 32, low: 25, code: 1 }
      ];
      this.updatedAt = 'Forecast unavailable';
    } finally {
      this.loading = false;
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
}
