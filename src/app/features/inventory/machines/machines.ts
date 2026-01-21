import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-machines',
  imports: [RouterModule],
  templateUrl: './machines.html',
  styleUrl: './machines.css',
})
export default class Machines {
  protected readonly title = signal('Máquinas');
}
