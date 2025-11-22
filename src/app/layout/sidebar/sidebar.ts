import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LogoLaserVeloz } from '@shared/components/logo-laser-veloz/logo-laser-veloz';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LogoLaserVeloz],
  template: `
    <div class="h-full bg-base-200 text-base-content flex flex-col">
      <!-- Logo Area -->
      <div class="p-4 mb-2">
        <a routerLink="/" class="btn btn-ghost text-xl normal-case">Zentoner</a>
      </div>
      <app-logo-laser-veloz fontSize="1.3rem"></app-logo-laser-veloz>

      <!-- Navigation Menu -->
      <ul class="menu w-full p-2 rounded-box">
        <li>
          <a routerLink="/dashboard" routerLinkActive="active">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Dashboard
          </a>
        </li>
        <li>
          <a routerLink="/profile" routerLinkActive="active">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            Profile
          </a>
        </li>
      </ul>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {}
