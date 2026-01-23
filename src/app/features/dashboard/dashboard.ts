import { Component, inject } from '@angular/core';
import { AuthService } from '@core/services/auth-service';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export default class Dashboard {
  // private readonly authService = inject(AuthService);
  // async ngOnInit() {
  //   console.log('Usuario actual en dashboard:', await this.authService.getUser());
  // }
}
