import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar';
import { HeaderComponent } from '../header/header';
import { FooterComponent } from '../footer/footer';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, FooterComponent],
  template: `
    <div class="flex h-screen bg-base-200">
      <!-- Sidebar (Hidden on mobile, visible on md+) -->
      <aside class="w-64 flex-none hidden md:block bg-base-100 shadow-xl z-20">
        <app-sidebar></app-sidebar>
      </aside>

      <!-- Main Content Area -->
      <div class="flex flex-col flex-1 overflow-hidden relative">
        <!-- Header -->
        <header class="h-16 flex-none bg-base-100 shadow-sm z-10">
          <app-header></app-header>
        </header>

        <!-- Page Content -->
        <main class="flex-1 overflow-y-auto p-6 scroll-smooth">
          <router-outlet></router-outlet>
        </main>

        <!-- Footer -->
        <footer class="flex-none p-4 bg-base-300 text-base-content">
          <app-footer></app-footer>
        </footer>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class MainLayoutComponent {}
