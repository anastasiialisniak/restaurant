import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import { GroupOrderDish } from '@app/models/group-orders/group-order-dish.model';
import { GroupOrderStatusResponse } from '@app/models/group-orders/group-order-status.model';
import { GroupSessionsResponse } from '@app/models/group-orders/group-sessions-response.model';
import { GuestInvite } from '@app/models/reservations/guest-invite.model';
import { GuestInviteService } from '@app/services/reservation/guest-invite.service';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';
import { SKIP_ERROR_TOAST } from '@app/auth/skip-error-toast.context';

export interface GroupOrderRequestOptions {
  silent?: boolean;
}

@Injectable({ providedIn: 'root' })
export class GroupOrdersService {
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);
  private readonly guestInviteService = inject(GuestInviteService);

  getGroupInvite$(reservationId: string): Observable<GuestInvite> {
    return this.guestInviteService.getInviteToken$(reservationId).pipe(
      switchMap(({ token }) => this.guestInviteService.getInvite$(token)),
    );
  }

  getSessions$(groupReservationId: string, options: GroupOrderRequestOptions = {}): Observable<GroupSessionsResponse> {
    return this.http.get<GroupSessionsResponse>(
      `${this.baseUrl}/guest/groups/${encodeURIComponent(groupReservationId)}/sessions`,
      { context: this.createContext(options) },
    );
  }

  getOwnerSessionId$(reservationId: string): Observable<string> {
    return this.http
      .get<{ guestSessionId: string }>(
        `${this.baseUrl}/reservations/${encodeURIComponent(reservationId)}/guest-session-id`,
      )
      .pipe(map(({ guestSessionId }) => guestSessionId));
  }

  getStatus$(groupReservationId: string, options: GroupOrderRequestOptions = {}): Observable<GroupOrderStatusResponse> {
    return this.http.get<GroupOrderStatusResponse>(
      `${this.baseUrl}/guest/groups/${encodeURIComponent(groupReservationId)}/status`,
      { context: this.createContext(options) },
    );
  }

  submit$(groupReservationId: string, reservationId: string): Observable<GroupOrderDish[]> {
    return this.http.post<GroupOrderDish[]>(
      `${this.baseUrl}/group-reservations/${encodeURIComponent(groupReservationId)}/submit`,
      { reservationId },
    );
  }

  removeSession$(groupReservationId: string, guestSessionId: string): Observable<GroupSessionsResponse> {
    return this.http.delete<GroupSessionsResponse>(
      `${this.baseUrl}/guest/groups/${encodeURIComponent(groupReservationId)}/sessions/${encodeURIComponent(guestSessionId)}`,
    );
  }

  private createContext(options: GroupOrderRequestOptions): HttpContext {
    return new HttpContext().set(SKIP_ERROR_TOAST, options.silent === true);
  }
}
