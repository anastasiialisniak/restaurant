import { DishListResponse } from '@app/models/dishes/dish-list-response.model';

const LOCAL_DISH_IMAGES: Readonly<Record<string, string>> = {
  'avocado-pine-nut-bowl': 'assets/img/dishes/avocado-pine-nut-bowl.jpg',
  'fresh-strawberry-mint-salad': 'assets/img/dishes/fresh-strawberry-mint-salad.jpg',
  'green-salad': 'assets/img/dishes/spring-salad.jpg',
  'roasted-sweet-potato-lentil-salad': 'assets/img/dishes/roasted-sweet-potato-and-lentil-salad.jpg',
  'spring-salad': 'assets/img/dishes/spring-salad.jpg',
};

const DISHES_WITHOUT_LOCAL_IMAGES = new Set([
  'grilled-salmon',
  'truffle-mushroom-risotto',
  'margherita-pizza',
]);

export function getDishImageUrl(dish: Pick<DishListResponse, 'name' | 'imageUrl'>): string {
  const dishName = dish.name
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (LOCAL_DISH_IMAGES[dishName]) return LOCAL_DISH_IMAGES[dishName];
  if (DISHES_WITHOUT_LOCAL_IMAGES.has(dishName)) return '';

  return dish.imageUrl || 'assets/img/dish.png';
}