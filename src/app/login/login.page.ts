import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { airplaneOutline, eyeOffOutline, eyeOutline, lockClosedOutline, mailOutline } from 'ionicons/icons';
import { PlannerStoreService, type AccountProfile } from '../planner-store.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(PlannerStoreService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  email = '';
  password = '';
  rememberMe = false;
  passwordVisible = false;
  loginError = '';
  registrationComplete = false;
  passwordResetComplete = false;
  googlePending = false;
  private googleResult = '';

  constructor() {
    addIcons({ airplaneOutline, eyeOffOutline, eyeOutline, lockClosedOutline, mailOutline });
    this.route.queryParamMap.subscribe(params => {
      this.registrationComplete = params.has('registered');
      this.passwordResetComplete = params.has('passwordReset');
      this.googleResult = params.get('google') || '';
      const googleErrors: Record<string, string> = {
        failed: 'Google sign-in could not be completed. Please try again.',
        cancelled: 'Google sign-in was cancelled. You can try again.',
        'existing-account': 'This email already has a password account. Sign in with your password, or use Forgot Password.'
      };
      this.loginError = googleErrors[this.googleResult] || '';
      this.changeDetector.markForCheck();
    });
  }

  ngOnInit(): void {
    void this.restoreSession();
  }

  private async restoreSession(): Promise<void> {
    if (this.googleResult === 'success') {
      try {
        const user = await this.store.completeGoogleSignIn();
        void this.store.recordTransaction({ action: 'login', description: 'Successful Google sign-in',
          email: user.email, createdAt: new Date().toISOString() }).catch(() => undefined);
        await this.router.navigateByUrl('/tabs/home');
      } catch {
        this.loginError = 'Unable to confirm Google sign-in. Please try again.';
        this.changeDetector.markForCheck();
      }
      return;
    }
    if (await this.store.getSession()) {
      await this.router.navigateByUrl('/tabs/home');
    }
  }

  async continueWithGoogle(): Promise<void> {
    if (this.googlePending) return;
    this.googlePending = true;
    this.loginError = '';
    try {
      window.location.assign(await this.store.googleSignInUrl());
    } catch {
      this.loginError = 'Google sign-in is unavailable. Please try again later.';
      this.googlePending = false;
      this.changeDetector.markForCheck();
    }
  }

  async login(): Promise<void> {
    this.loginError = '';
    let user: AccountProfile | null;
    try {
      user = await this.store.authenticateUser(this.email, this.password);
    } catch {
      this.loginError = 'Unable to reach the sign-in service. Please try again later.';
      this.changeDetector.markForCheck();
      return;
    }

    if (!user) {
      this.loginError = 'Email or password is incorrect.';
      this.password = '';
      this.changeDetector.markForCheck();
      return;
    }

    this.store.setSession(user);
    this.email = '';
    this.password = '';
    this.rememberMe = false;
    this.changeDetector.markForCheck();
    void this.store.recordTransaction({
      action: 'login',
      description: 'Successful sign-in',
      email: user.email,
      createdAt: new Date().toISOString()
    }).catch(() => undefined);
    await this.router.navigateByUrl('/tabs/home');
  }
}
