import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-header',
  template: `
    <nav class="navbar w-full bg-base-100">
      <div class="sm:flex lg:hidden flex justify-center">
        <label
          class="btn btn-circle btn-ghost flex justify-center items-center w-11 h-11 relative"
          for="my-drawer-4"
          aria-label="open sidebar"
        >
          <span
            class="icon-[material-symbols--menu-rounded] absolute w-7 h-7 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
          ></span>
        </label>
      </div>
      <div class="flex-1">
        <a class="btn btn-ghost text-xl lg:hidden">Zentoner</a>
      </div>
      <div class="flex">
        <div class="flex items-center">
          <span class="text-sm font-semibold">{{ userName() }}</span>
          <span class="text-sm font-semibold">{{ userEmail() }}</span>
        </div>
        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar">
            <div class="w-10 rounded-full">
              <img
                alt="Tailwind CSS Navbar component"
                src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"
              />
            </div>
          </div>
          <ul
            tabindex="0"
            class="mt-3 z-1 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52"
          >
            <li>
              <a class="justify-between"> Profile </a>
            </li>
            <li><a>Settings</a></li>
            <li><a>Logout</a></li>
          </ul>
        </div>
      </div>
    </nav>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  protected readonly userName = input<string>();
  protected readonly userEmail = input<string>();
}
