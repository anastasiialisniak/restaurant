import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, Observable, forkJoin, interval, of } from 'rxjs';
import { catchError, exhaustMap, finalize, map, switchMap, tap } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { ParticipantCardComponent } from '@app/components/group-orders/participant-card/participant-card.component';
import { GroupOrderStatusResponse } from '@app/models/group-orders/group-order-status.model';
import { Participant } from '@app/models/group-orders/participant.model';
import { GuestInvite } from '@app/models/reservations/guest-invite.model';
import { GroupOrdersService } from '@app/services/group-orders/group-orders.service';
import { ToastService } from '@app/services/toast/toast.service';
import { ModalComponent } from '@app/shared/custom-components/modal/modal.component';
import { consolidatePreOrder } from '@app/shared/helpers/consolidate-pre-order';

const SYNC_INTERVAL_MS = 15_000;

@Component({
  selector: 'app-group-order-page',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, ParticipantCardComponent, ModalComponent],
  templateUrl: './group-order-page.component.html',
  styleUrl: './group-order-page.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class GroupOrderPageComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly groupOrdersService = inject(GroupOrdersService);
  private readonly toast = inject(ToastService);
  private readonly reservationId = this.route.snapshot.paramMap.get('reservationId') ?? '';
  private pollingSubscription?: Subscription;
  private refreshInFlight = false;

  readonly invite = signal<GuestInvite | null>(null);
  readonly participants = signal<Participant[]>([]);
  readonly ownerSessionId = signal<string | null>(null);
  readonly groupStatus = signal<GroupOrderStatusResponse | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly confirmationOpen = signal(false);
  readonly submitting = signal(false);
  readonly selectedGuest = signal<Participant | null>(null);
  readonly removingGuest = signal(false);
  readonly updatedAt = signal<string | null>(null);
  readonly refreshError = signal<string | null>(null);

  readonly consolidatedOrder = computed(() => consolidatePreOrder(this.participants()));
  readonly grandTotal = computed(() =>
    this.consolidatedOrder().reduce((total, dish) => total + dish.price * dish.quantity, 0),
  );
  readonly unsubmittedGuestCount = computed(
    () => this.participants().filter((person) => person.type === 'Guest' && !person.isSubmitted).length,
  );
  readonly unsubmittedGuestMessage = computed(() => {
    const count = this.unsubmittedGuestCount();
    const participants = count === 1 ? 'participant' : 'participants';
    const have = count === 1 ? "hasn't" : "haven't";
    return `${count} ${participants} ${have} submitted their cart yet — their dishes won't be included in the order`;
  });
  readonly hasNoDishes = computed(() => !this.participants().some((person) => person.items.length > 0));
  readonly isReadOnly = computed(() => {
    const status = this.groupStatus()?.status;
    return status === 'Submitted' || status === 'Closed';
  });
  readonly statusLabel = computed(() => {
    const status = this.groupStatus()?.status;
    if (status === 'Submitted') return 'Sent to Restaurant';
    if (status === 'Closed') return 'Closed';
    return 'Collecting pre-orders';
  });
  readonly updatedAtLabel = computed(() => (this.updatedAt() ? `Updated at ${this.updatedAt()}` : ''));

  ngOnInit(): void {
    this.loadGroupOrder();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  loadGroupOrder(): void {
    this.stopPolling();
    if (!this.reservationId) {
      this.loadError.set('Group reservation not found');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);

    this.groupOrdersService
      .getGroupInvite$(this.reservationId)
      .pipe(
        switchMap((invite) =>
          forkJoin({
            sessions: this.groupOrdersService.getSessions$(invite.GroupReservationId),
            ownerSessionId: this.groupOrdersService.getOwnerSessionId$(this.reservationId),
            status: this.groupOrdersService.getStatus$(invite.GroupReservationId),
          }).pipe(map((data) => ({ invite, ...data }))),
        ),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ invite, sessions, ownerSessionId, status }) => {
          this.invite.set(invite);
          this.participants.set(sessions.participants);
          this.ownerSessionId.set(ownerSessionId);
          this.groupStatus.set(status);
          this.updatedAt.set(this.formatTime());
          this.refreshError.set(null);
          if (status.status === 'Open') this.startPolling();
        },
        error: (error: HttpErrorResponse) => {
          this.loadError.set(
            error.status === 404 ? 'Group reservation not found' : 'Unable to load group order. Please try again.',
          );
        },
      });
  }

  refreshNow(): void {
    this.refreshGroupOrder().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  openConfirmation(): void {
    if (this.isReadOnly() || this.submitting() || this.consolidatedOrder().length === 0) return;
    this.confirmationOpen.set(true);
  }

  closeConfirmation(): void {
    if (!this.submitting()) this.confirmationOpen.set(false);
  }

  submitPreOrder(): void {
    const invite = this.invite();
    if (!invite || this.isReadOnly() || this.submitting() || this.consolidatedOrder().length === 0) return;

    this.stopPolling();
    this.submitting.set(true);
    this.groupOrdersService
      .submit$(invite.GroupReservationId, this.reservationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const status = this.groupStatus();
          if (status) this.groupStatus.set({ ...status, status: 'Submitted' });
          this.submitting.set(false);
          this.confirmationOpen.set(false);
          this.refreshError.set(null);
          this.toast.success('Pre-order sent to the restaurant');
        },
        error: () => {
          // The token interceptor reports submit errors; keep the screen available for a retry.
          this.submitting.set(false);
          if (this.groupStatus()?.status === 'Open') this.startPolling();
        },
      });
  }

  openRemoveConfirmation(participant: Participant): void {
    if (participant.type === 'Guest' && !this.isReadOnly() && !this.removingGuest()) {
      this.selectedGuest.set(participant);
    }
  }

  closeRemoveConfirmation(): void {
    if (!this.removingGuest()) this.selectedGuest.set(null);
  }

  removeGuest(): void {
    const guest = this.selectedGuest();
    const invite = this.invite();
    if (!guest || guest.type !== 'Guest' || !invite || this.isReadOnly() || this.removingGuest()) return;

    this.stopPolling();
    this.removingGuest.set(true);
    this.groupOrdersService
      .removeSession$(invite.GroupReservationId, guest.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sessions) => {
          this.participants.set(sessions.participants);
          this.updatedAt.set(this.formatTime());
          this.refreshError.set(null);
          this.selectedGuest.set(null);
          this.removingGuest.set(false);
          if (this.groupStatus()?.status === 'Open') this.startPolling();
        },
        error: () => {
          // The token interceptor reports DELETE errors; preserve the current participants.
          this.removingGuest.set(false);
          if (this.groupStatus()?.status === 'Open') this.startPolling();
        },
      });
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollingSubscription = interval(SYNC_INTERVAL_MS)
      .pipe(
        exhaustMap(() => this.refreshGroupOrder()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private stopPolling(): void {
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = undefined;
  }

  private refreshGroupOrder(): Observable<void> {
    const invite = this.invite();
    if (!invite || this.refreshInFlight || this.groupStatus()?.status !== 'Open') return EMPTY;

    this.refreshInFlight = true;
    const options = { silent: true };
    return forkJoin({
      sessions: this.groupOrdersService.getSessions$(invite.GroupReservationId, options),
      status: this.groupOrdersService.getStatus$(invite.GroupReservationId, options),
    }).pipe(
      tap(({ sessions, status }) => {
        this.participants.set(sessions.participants);
        this.groupStatus.set(status);
        this.updatedAt.set(this.formatTime());
        this.refreshError.set(null);
        if (status.status !== 'Open') this.stopPolling();
      }),
      map(() => void 0),
      catchError(() => {
        const lastSuccessfulUpdate = this.updatedAt() ?? 'the last successful update';
        this.refreshError.set(`Couldn't refresh. Showing data from ${lastSuccessfulUpdate}.`);
        return of(void 0);
      }),
      finalize(() => (this.refreshInFlight = false)),
    );
  }

  private formatTime(): string {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
