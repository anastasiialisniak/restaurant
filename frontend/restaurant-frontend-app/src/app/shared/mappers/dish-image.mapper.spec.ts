import { getDishImageUrl } from './dish-image.mapper';

const apiSaladUrl = 'https://api.example.test/images/shared-salad.jpg';

function dish(name: string) {
  return { name, imageUrl: apiSaladUrl };
}

describe('getDishImageUrl', () => {
  it('uses the provided spring salad asset for Green Salad', () => {
    expect(getDishImageUrl(dish('Green Salad'))).toBe('assets/img/dishes/spring-salad.jpg');
  });

  it('does not reuse the unrelated API salad image for dishes without a matching asset', () => {
    expect(getDishImageUrl(dish('Grilled Salmon'))).toBe('');
    expect(getDishImageUrl(dish('Truffle Mushroom Risotto'))).toBe('');
    expect(getDishImageUrl(dish('Margherita Pizza'))).toBe('');
  });

  it('preserves API images for other dishes', () => {
    expect(getDishImageUrl(dish('Another Dish'))).toBe(apiSaladUrl);
  });
});