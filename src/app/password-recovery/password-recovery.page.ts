import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import { PlannerStoreService } from '../planner-store.service';

@Component({
  selector: 'app-password-recovery',
  templateUrl: './password-recovery.page.html',
  styleUrls: ['../login/login.page.scss'],
  imports: [FormsModule, RouterLink, IonicModule]
})
export class PasswordRecoveryPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(PlannerStoreService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly resetMode = this.route.snapshot.data['reset'] === true;
  private readonly token = new URLSearchParams(this.route.snapshot.fragment || '').get('token') || '';
  readonly validLink = /^[A-Za-z0-9_-]{43}$/.test(this.token);
  email = '';
  password = '';
  confirmPassword = '';
  pending = false;
  message = '';
  error = '';

  constructor() {
    if (this.resetMode && this.route.snapshot.fragment) {
      void this.router.navigate([], { relativeTo: this.route, fragment: '', replaceUrl: true });
    }
  }

  async submit(): Promise<void> {
    if (this.pending) return;
    this.error = '';
    if (this.resetMode) {
      if (!this.validLink) {
        this.error = 'This reset link is invalid. Request a new link.';
        return;
      }
      if (this.password !== this.confirmPassword) {
        this.error = 'Passwords do not match.';
        return;
      }
      if (this.password.length < 8 || this.password.length > 128 || new TextEncoder().encode(this.password).length > 72) {
        this.error = 'Use at least 8 characters. Your password must fit within 72 UTF-8 bytes.';
        return;
      }
    }
    this.pending = true;
    try {
      if (this.resetMode) {
        await this.store.resetPassword(this.token, this.password);
        this.password = '';
        this.confirmPassword = '';
        await this.router.navigateByUrl('/login?passwordReset=1');
      } else {
        this.message = (await this.store.requestPasswordReset(this.email)).message;
      }
    } catch (error) {
      this.error = error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
        ? error.error.error : 'Unable to reach the password reset service. Please try again later.';
    } finally {
      this.pending = false;
      this.changeDetector.markForCheck();
    }
  }
}
