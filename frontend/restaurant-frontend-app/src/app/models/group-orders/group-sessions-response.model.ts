import { Participant } from './participant.model';

export interface GroupSessionsResponse {
  participants: Participant[];
  total: number;
}
