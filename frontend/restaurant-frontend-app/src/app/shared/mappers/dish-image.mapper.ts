import { DishListResponse } from '@app/models/dishes/dish-list-response.model';

const LOCAL_DISH_IMAGES: Readonly<Record<string, string>> = {
  'avocado-pine-nut-bowl': 'assets/img/dishes/avocado-pine-nut-bowl.jpg',
  'fresh-strawberry-mint-salad': 'assets/img/dishes/fresh-strawberry-mint-salad.jpg',
  'green-salad': 'assets/img/dishes/green-salad.jpg',
  'roasted-sweet-potato-lentil-salad': 'assets/img/dishes/roasted-sweet-potato-and-lentil-salad.jpg',
  'spring-salad': 'assets/img/dishes/spring-salad.jpg',
};

const LOCAL_DISH_IMAGES_BY_ID: Readonly<Record<string, string>> = {
  '3a6058ab-493f-4dc7-b2df-3a492be1268d': 'assets/img/dishes/green-salad.jpg',
};

export function getDishImageUrl(
  dish: Pick<DishListResponse, 'id' | 'name' | 'imageUrl'>,
): string {
  const localImage = LOCAL_DISH_IMAGES_BY_ID[dish.id];
  if (localImage) return localImage;

  const apiImage = dish.imageUrl?.trim();
  if (apiImage) return apiImage;

  const dishName = dish.name
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return LOCAL_DISH_IMAGES[dishName] || 'assets/img/dish.png';
}