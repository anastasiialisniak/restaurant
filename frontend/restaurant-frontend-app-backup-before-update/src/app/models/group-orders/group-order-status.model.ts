export type GroupOrderStatus = 'Open' | 'Submitted' | 'Closed';

export interface GroupOrderStatusResponse {
  status: GroupOrderStatus;
  currentParticipants?: number;
  maxCapacity?: number;
  totalGuests?: number;
  submittedGuests?: number;
}
