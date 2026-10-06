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

  constructor() {
    addIcons({ airplaneOutline, eyeOffOutline, eyeOutline, lockClosedOutline, mailOutline });
    this.route.queryParamMap.subscribe(params => {
      this.registrationComplete = params.has('registered');
      this.changeDetector.markForCheck();
    });
  }

  ngOnInit(): void {
    void this.restoreSession();
  }

  private async restoreSession(): Promise<void> {
    if (await this.store.getSession()) {
      await this.router.navigateByUrl('/tabs/home');
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
