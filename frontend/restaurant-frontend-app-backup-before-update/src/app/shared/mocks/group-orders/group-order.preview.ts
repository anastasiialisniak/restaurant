import { Participant } from '@app/models/group-orders/participant.model';
import { GuestInvite } from '@app/models/reservations/guest-invite.model';

export const GROUP_ORDER_PREVIEW: {
  invite: GuestInvite;
  sessions: { total: number; participants: Participant[] };
} = {
  invite: {
    GroupReservationId: 'preview-group-reservation',
    LocationId: 'preview-location',
    RestaurantName: 'Green Tasty',
    LocationAddress: 'Rustaveli Avenue 48',
    StartTime: '2026-10-21T12:00:00',
    EndTime: '2026-10-21T14:00:00',
    MaxGuestCount: 5,
    TableNumber: 1,
    InviterName: 'Yevhenii',
  },
  sessions: {
    total: 74.5,
    participants: [
      {
        id: 'owner-session',
        type: 'Owner',
        name: 'Yevhenii',
        isSubmitted: true,
        total: 24.5,
        items: [
          { dish: { id: 'strawberry-salad', name: 'Fresh Strawberry Mint Salad', price: 14.5 }, quantity: 1 },
          { dish: { id: 'fresh-lemonade', name: 'Fresh Lemonade', price: 10 }, quantity: 1 },
        ],
      },
      {
        id: 'maria-session',
        type: 'Guest',
        name: 'Maria',
        isSubmitted: true,
        total: 20,
        items: [{ dish: { id: 'green-bowl', name: 'Green Bowl', price: 20 }, quantity: 1 }],
      },
      {
        id: 'alex-session',
        type: 'Guest',
        name: 'Alex',
        isSubmitted: false,
        total: 18,
        items: [
          { dish: { id: 'quinoa-salad', name: 'Quinoa Salad', price: 11 }, quantity: 1 },
          { dish: { id: 'sparkling-water', name: 'Sparkling Water', price: 7 }, quantity: 1 },
        ],
      },
      {
        id: 'julia-session',
        type: 'Guest',
        name: 'Julia',
        isSubmitted: true,
        total: 12,
        items: [{ dish: { id: 'caesar-salad', name: 'Caesar Salad', price: 12 }, quantity: 1 }],
      },
    ],
  },
};
