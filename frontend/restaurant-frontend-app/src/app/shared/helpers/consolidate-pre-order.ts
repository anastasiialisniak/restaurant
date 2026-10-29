import { Participant } from '@app/models/group-orders/participant.model';

export interface ConsolidatedDish {
  dishId: string;
  name: string;
  price: number;
  quantity: number;
}

export function consolidatePreOrder(participants: Participant[]): ConsolidatedDish[] {
  const dishes = new Map<string, ConsolidatedDish>();

  for (const participant of participants) {
    if (!participant.isSubmitted) continue;

    for (const item of participant.items) {
      const current = dishes.get(item.dish.id);
      if (current) {
        current.quantity += item.quantity;
      } else {
        dishes.set(item.dish.id, {
          dishId: item.dish.id,
          name: item.dish.name,
          price: item.dish.price,
          quantity: item.quantity,
        });
      }
    }
  }

  return [...dishes.values()];
}
