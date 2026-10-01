import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { airplaneOutline, eyeOffOutline, eyeOutline, lockClosedOutline, mailOutline } from 'ionicons/icons';
import { PlannerStoreService } from '../planner-store.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
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

  async login(): Promise<void> {
    this.loginError = '';
    try {
      const user = await this.store.authenticateUser(this.email, this.password);
      if (!user) {
        this.loginError = 'Email or password is incorrect.';
        this.password = '';
        this.changeDetector.markForCheck();
        return;
      }
      await this.store.recordTransaction({
        action: 'login',
        description: 'Successful sign-in',
        email: user.email,
        createdAt: new Date().toISOString()
      });
      this.store.setSession(user);
      this.email = '';
      this.password = '';
      this.rememberMe = false;
      this.changeDetector.markForCheck();
    } catch {
      this.loginError = 'Sign-in could not be verified in this browser. Please try again.';
      this.changeDetector.markForCheck();
      return;
    }
    await this.router.navigateByUrl('/tabs/home');
  }
}
