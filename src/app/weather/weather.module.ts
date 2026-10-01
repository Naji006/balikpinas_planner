import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { WeatherPageRoutingModule } from './weather-routing.module';

import { WeatherPage } from './weather.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    WeatherPageRoutingModule
  ],
  declarations: [WeatherPage]
})
export class WeatherPageModule {}
