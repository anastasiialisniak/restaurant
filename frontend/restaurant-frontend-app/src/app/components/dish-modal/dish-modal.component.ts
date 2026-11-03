import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { DishListResponse } from '@app/models/dishes/dish-list-response.model';

@Component({
  selector: 'app-dish-modal',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './dish-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './dish-modal.component.scss',
})
export class DishModalComponent {
  @Input({ required: true }) dish!: DishListResponse;
  @Output() closed = new EventEmitter<void>();

  imageLoadFailed = false;

  onClose(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.onClose();
  }

  onImageError(): void {
    this.imageLoadFailed = true;
  }

  formatMeasurement(value: string | number | null | undefined, unit: 'g' | 'kcal'): string {
    const measurement = String(value ?? '').trim();
    if (!measurement) return '—';

    const repeatedUnit = new RegExp('(\\s*' + unit + '\\s*)+$', 'i');
    const amount = measurement.replace(repeatedUnit, '').trim();
    return amount ? amount + ' ' + unit : '—';
  }
}