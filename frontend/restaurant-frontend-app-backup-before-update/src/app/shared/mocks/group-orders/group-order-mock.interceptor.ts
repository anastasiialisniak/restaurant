import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { GroupOrderDish } from '@app/models/group-orders/group-order-dish.model';
import { Participant } from '@app/models/group-orders/participant.model';
import { consolidatePreOrder } from '@app/shared/helpers/consolidate-pre-order';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';

const DEMO_GROUP_ID = 'demo-group-reservation';
const DEMO_INVITE_TOKEN = 'demo-group-invite';
let submitted = false;
const removedDemoGuestIds = new Set<string>();

function demoParticipants(): Participant[] {
  const participants: Participant[] = [
    {
      id: 'owner-session', type: 'Owner', name: 'Yevhenii', isSubmitted: true, total: 180,
      items: [{ dish: { id: 'dish1', name: 'Caesar Salad', price: 180 }, quantity: 1 }],
    },
    {
      id: 'andrii-session', type: 'Guest', name: 'Andrii', isSubmitted: true, total: 360,
      items: [{ dish: { id: 'dish1', name: 'Caesar Salad', price: 180 }, quantity: 2 }],
    },
    {
      id: 'olena-session', type: 'Guest', name: 'Olena', isSubmitted: false, total: 220,
      items: [{ dish: { id: 'dish2', name: 'Tom Yum', price: 220 }, quantity: 1 }],
    },
  ];
  return participants.filter((participant) => !removedDemoGuestIds.has(participant.id));
}

function reply<T>(body: T) {
  return of(new HttpResponse<T>({ status: 200, body }));
}

export const groupOrderMockInterceptor: HttpInterceptorFn = (request, next) => {
  const mockEnabled = (environment as typeof environment & { groupOrderMocks?: boolean }).groupOrderMocks === true;
  if (!mockEnabled) return next(request);

  const path = new URL(request.url, 'http://localhost').pathname;

  if (request.method === 'GET' && path.endsWith('/reservations/demo-reservation/invite-token')) {
    return reply({ token: DEMO_INVITE_TOKEN });
  }

  if (request.method === 'GET' && path.endsWith(`/guest/invites/${DEMO_INVITE_TOKEN}`)) {
    return reply({
      GroupReservationId: DEMO_GROUP_ID,
      LocationId: 'demo-location',
      RestaurantName: 'Green Tasty',
      LocationAddress: 'Rustaveli Avenue 48',
      StartTime: '2026-10-21T16:00:00Z',
      EndTime: '2026-10-21T17:30:00Z',
      MaxGuestCount: 5,
      TableNumber: 1,
      InviterName: 'Yevhenii',
    });
  }

  if (request.method === 'GET' && path.endsWith(`/guest/groups/${DEMO_GROUP_ID}/sessions`)) {
    const participants = demoParticipants();
    return reply({ participants, total: participants.reduce((sum, person) => sum + person.total, 0) });
  }

  if (request.method === 'GET' && path.endsWith('/reservations/demo-reservation/guest-session-id')) {
    return reply({ guestSessionId: 'owner-session' });
  }

  if (request.method === 'GET' && path.endsWith(`/guest/groups/${DEMO_GROUP_ID}/status`)) {
    return reply({ currentParticipants: 3 - removedDemoGuestIds.size, maxCapacity: 5, status: submitted ? 'Submitted' : 'Open' });
  }

  if (request.method === 'POST' && path.endsWith(`/group-reservations/${DEMO_GROUP_ID}/submit`)) {
    submitted = true;
    const result: GroupOrderDish[] = consolidatePreOrder(demoParticipants()).map(({ dishId, quantity }) => ({ dishId, quantity }));
    return reply(result);
  }

  const removePrefix = `/guest/groups/${DEMO_GROUP_ID}/sessions/`;
  if (request.method === 'DELETE' && path.startsWith(removePrefix)) {
    const guestSessionId = decodeURIComponent(path.slice(removePrefix.length));
    const guest = demoParticipants().find((participant) => participant.id === guestSessionId);
    if (guest?.type === 'Guest' && !submitted) {
      removedDemoGuestIds.add(guestSessionId);
      const participants = demoParticipants();
      return reply({ participants, total: participants.reduce((sum, person) => sum + person.total, 0) });
    }
  }

  return next(request);
};
