import { getDishImageUrl } from './dish-image.mapper';

const productionImageBase =
  'https://restaurant-backend-dev-images-093147866983.s3.us-west-2.amazonaws.com/assets/img/dishes/';

const verifiedCatalog = [
  {
    id: '15673599-3a6f-44fc-8b76-e64f2f4f2ce3',
    name: 'Grilled Salmon 2',
    imageUrl: productionImageBase + 'dish_15673599-3a6f-44fc-8b76-e64f2f4f2ce3',
  },
  {
    id: '95f0b087-4128-428f-bd3c-cc3353471e75',
    name: 'Truffle Mushroom Risotto',
    imageUrl: productionImageBase + 'dish_95f0b087-4128-428f-bd3c-cc3353471e75',
  },
  {
    id: '3a6058ab-493f-4dc7-b2df-3a492be1268d',
    name: 'Green Salad',
    imageUrl: productionImageBase + 'dish_3a6058ab-493f-4dc7-b2df-3a492be1268d',
  },
  {
    id: '1862cae4-8538-4905-92ca-7c849c701b3c',
    name: 'Margherita Pizza',
    imageUrl: productionImageBase + 'dish_1862cae4-8538-4905-92ca-7c849c701b3c',
  },
  {
    id: 'b370f005-6ae3-4eab-b38d-0ba54558e198',
    name: 'Fresh Avocado Toast',
    imageUrl: productionImageBase + 'dish_b370f005-6ae3-4eab-b38d-0ba54558e198',
  },
  {
    id: '07efc9a8-e9fc-4612-9e80-59fda0dc7fc3',
    name: 'Grilled Salmon',
    imageUrl: productionImageBase + 'dish_07efc9a8-e9fc-4612-9e80-59fda0dc7fc3',
  },
  {
    id: 'd2d165f7-4259-4a13-93cd-d20715e7d130',
    name: 'Margherita Pizza',
    imageUrl: productionImageBase + 'dish_d2d165f7-4259-4a13-93cd-d20715e7d130',
  },
  {
    id: '3c8207b9-945a-4a42-a4bc-5dad3eb3d992',
    name: 'Grilled Salmon',
    imageUrl: productionImageBase + 'dish_3c8207b9-945a-4a42-a4bc-5dad3eb3d992',
  },
];

describe('getDishImageUrl', () => {
  it('uses the local salad photo for the exact Green Salad ID', () => {
    expect(getDishImageUrl(verifiedCatalog[2])).toBe('assets/img/dishes/green-salad.jpg');
  });

  it('preserves the seven verified production photos for their exact dish IDs', () => {
    const dishesWithoutGreenSalad = verifiedCatalog.filter(
      (dish) => dish.id !== '3a6058ab-493f-4dc7-b2df-3a492be1268d',
    );
    const mappedImages = dishesWithoutGreenSalad.map((dish) => getDishImageUrl(dish));

    expect(mappedImages).toEqual(dishesWithoutGreenSalad.map((dish) => dish.imageUrl));
    expect(new Set(mappedImages).size).toBe(7);
  });

  it('keeps photos distinct when different dishes share a name', () => {
    const salmonDishes = verifiedCatalog.filter((dish) => dish.name.startsWith('Grilled Salmon'));
    const pizzaDishes = verifiedCatalog.filter((dish) => dish.name === 'Margherita Pizza');

    expect(new Set(salmonDishes.map((dish) => getDishImageUrl(dish))).size).toBe(3);
    expect(new Set(pizzaDishes.map((dish) => getDishImageUrl(dish))).size).toBe(2);
  });

  it('uses a known local asset when an older dish has no API image', () => {
    expect(
      getDishImageUrl({
        id: 'legacy-avocado-bowl',
        name: 'Avocado Pine Nut Bowl',
        imageUrl: '',
      }),
    ).toBe('assets/img/dishes/avocado-pine-nut-bowl.jpg');
  });

  it('uses the generic fallback only when neither an API nor local match exists', () => {
    expect(
      getDishImageUrl({
        id: 'unknown-dish',
        name: 'Another Dish',
        imageUrl: '',
      }),
    ).toBe('assets/img/dish.png');
  });
});