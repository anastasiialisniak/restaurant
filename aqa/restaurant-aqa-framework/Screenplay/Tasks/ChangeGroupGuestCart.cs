using Restaurant_Aqa_Framework.Api;
using Restaurant_Aqa_Framework.Api.Dtos.GroupOrders;

namespace Restaurant_Aqa_Framework.Screenplay.Tasks;

/// <summary>Changes one seeded guest cart through its guest-session token, then remembers the new fixture quantity.</summary>
public sealed class ChangeGroupGuestCart(int guestIndex, int quantityToAdd) : ITask
{
    public async Task PerformAsAsync(Actor actor)
    {
        var fixture = actor.Recall<GroupOrderFixture>();
        if (guestIndex < 0 || guestIndex >= fixture.Guests.Count)
            throw new InvalidOperationException("The requested group guest was not set up.");
        if (quantityToAdd <= 0)
            throw new InvalidOperationException("A cart update must add a positive quantity.");

        var guest = fixture.Guests[guestIndex];
        var response = await new GuestSessionsApi(actor.UsingTheApi()).AddDishAsync(
            guest.SessionId, guest.SessionToken, fixture.Dish.Id, quantityToAdd);
        await actor.TheLastResponse().CaptureAsync(response);
        if (!actor.TheLastResponse().Succeeded)
            throw new InvalidOperationException($"Changing the guest cart failed with HTTP {actor.TheLastResponse().Status}: {actor.TheLastResponse().Body}");

        var guests = fixture.Guests.ToArray();
        guests[guestIndex] = guest with { Quantity = guest.Quantity + quantityToAdd };
        actor.Remember(fixture with { Guests = guests });
    }
}
