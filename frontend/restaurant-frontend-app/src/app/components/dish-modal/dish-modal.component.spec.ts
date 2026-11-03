import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DishListResponse } from '@app/models/dishes/dish-list-response.model';
import { DishModalComponent } from './dish-modal.component';

describe('DishModalComponent', () => {
  let component: DishModalComponent;
  let fixture: ComponentFixture<DishModalComponent>;

  const dish: DishListResponse = {
    id: 'dish-1',
    name: 'Grilled Salmon',
    imageUrl: 'assets/img/dishes/green-salad.jpg',
    price: 18.99,
    state: 'Available',
    dishType: 'Main Course',
    weight: '300 g',
    description: 'Grilled salmon with lemon and seasonal vegetables.',
    calories: '320 kcal kcal',
    proteins: '18 g',
    fats: '9g',
    carbohydrates: '24 g',
    vitamins: 'Vitamin D, B12, Omega-3',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DishModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DishModalComponent);
    component = fixture.componentInstance;
    component.dish = dish;
    fixture.detectChanges();
  });

  it('renders the dish details in a semantic dialog', () => {
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    const renderedText = dialog.textContent ?? '';

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.querySelector('h2')?.textContent).toContain('Grilled Salmon');
    expect(renderedText).toContain('Grilled salmon with lemon and seasonal vegetables.');
    expect(renderedText).toContain('$18.99');
    expect(renderedText).toContain('300 g');
    expect(renderedText).toContain('320 kcal');
    expect(renderedText).not.toContain('320 kcal kcal');
    expect(renderedText).toContain('18 g');
    expect(renderedText).toContain('9 g');
    expect(renderedText).toContain('24 g');
    expect(renderedText).toContain('Vitamin D, B12, Omega-3');
  });

  it('shows a descriptive image and an accessible close control', () => {
    const image = fixture.nativeElement.querySelector('.dish-image') as HTMLImageElement;
    const closeButton = fixture.nativeElement.querySelector('.close-button') as HTMLButtonElement;

    expect(image.alt).toBe('Grilled Salmon');
    expect(closeButton.getAttribute('aria-label')).toBe('Close dish details');
  });

  it('emits closed when the close button is clicked', () => {
    spyOn(component.closed, 'emit');
    (fixture.nativeElement.querySelector('.close-button') as HTMLButtonElement).click();

    expect(component.closed.emit).toHaveBeenCalled();
  });

  it('emits closed when the backdrop is clicked', () => {
    spyOn(component.closed, 'emit');
    (fixture.nativeElement.querySelector('.modal-overlay') as HTMLDivElement).click();

    expect(component.closed.emit).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    spyOn(component.closed, 'emit');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(component.closed.emit).toHaveBeenCalled();
  });

  it('shows a fallback if the dish photo cannot load', () => {
    const image = fixture.nativeElement.querySelector('.dish-image') as HTMLImageElement;
    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.image-placeholder')).toBeTruthy();
  });
});