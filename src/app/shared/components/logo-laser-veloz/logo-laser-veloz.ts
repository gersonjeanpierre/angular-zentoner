import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-logo-laser-veloz',
  imports: [],
  templateUrl: './logo-laser-veloz.html',
  styleUrl: './logo-laser-veloz.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoLaserVeloz {
  readonly fontSize = input<string>();
}
