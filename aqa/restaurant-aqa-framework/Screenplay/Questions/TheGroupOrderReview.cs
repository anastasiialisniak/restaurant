using Microsoft.Playwright;
using Restaurant_Aqa_Framework.Api.Dtos.GroupOrders;
using Restaurant_Aqa_Framework.Ui;

namespace Restaurant_Aqa_Framework.Screenplay.Questions;

public sealed class TheGroupOrderReview : IQuestion<GroupOrderReviewSnapshot>
{
    public async Task<GroupOrderReviewSnapshot> AnsweredByAsync(Actor actor)
    {
        var fixture = actor.Recall<GroupOrderFixture>();
        var page = new GroupOrderReviewPage(actor.LookingAtThePage());
        await page.PageTitle.WaitForAsync(new() { State = WaitForSelectorState.Visible });

        foreach (var guest in fixture.Guests)
        {
            var card = page.ParticipantCardFor(guest.Name);
            await card.WaitForAsync(new() { State = WaitForSelectorState.Visible });
            if (guest.Quantity == 0)
            {
                await card.Locator(".empty").WaitForAsync(new() { State = WaitForSelectorState.Visible });
            }
            else
            {
                await Assertions.Expect(card.Locator(".qty").First).ToContainTextAsync($"× {guest.Quantity}");
            }
        }

        return await page.ReadSnapshotAsync();
    }
}
