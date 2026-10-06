import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { arrowBackOutline, callOutline, eyeOffOutline, eyeOutline, lockClosedOutline, mailOutline, personOutline } from 'ionicons/icons';
import { PlannerStoreService } from '../planner-store.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false,
})
export class RegisterPage {
  private readonly router = inject(Router);
  private readonly store = inject(PlannerStoreService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  fullName = '';
  email = '';
  phone = '';
  password = '';
  confirmPassword = '';
  passwordVisible = false;
  confirmPasswordVisible = false;
  registrationError = '';

  constructor() {
    addIcons({ arrowBackOutline, callOutline, eyeOffOutline, eyeOutline, lockClosedOutline, mailOutline, personOutline });
  }

  async register(): Promise<void> {
    this.registrationError = '';
    if (this.password !== this.confirmPassword) {
      this.registrationError = 'Passwords do not match.';
      this.changeDetector.markForCheck();
      return;
    }
    try {
      const created = await this.store.registerAccount({
        fullName: this.fullName.trim(),
        email: this.email.trim(),
        phone: this.phone.trim()
      }, this.password);
      if (!created) {
        this.registrationError = 'An account with this email already exists.';
        this.changeDetector.markForCheck();
        return;
      }
      await this.store.recordTransaction({
        action: 'registration',
        description: 'Account registered',
        email: this.email.trim().toLowerCase(),
        createdAt: new Date().toISOString()
      });
      await this.store.clearSession();
      await this.router.navigateByUrl('/login?registered=1');
    } catch {
      this.registrationError = 'This browser could not save the account. Please try again.';
      this.changeDetector.markForCheck();
    }
  }
}
