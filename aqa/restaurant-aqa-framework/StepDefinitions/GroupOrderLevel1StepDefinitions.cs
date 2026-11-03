using System.Globalization;
using Restaurant_Aqa_Framework.Api.Dtos.GroupOrders;
using Restaurant_Aqa_Framework.Configuration;
using Restaurant_Aqa_Framework.Screenplay;
using Restaurant_Aqa_Framework.Screenplay.Questions;
using Restaurant_Aqa_Framework.Screenplay.Tasks;
using Restaurant_Aqa_Framework.Ui;

namespace Restaurant_Aqa_Framework.StepDefinitions;

[Binding]
public sealed class GroupOrderLevel1StepDefinitions(Actor actor) : StepDefinitionBase(actor)
{
    [Given("the Owner has a group order with these guest carts:")]
    public Task GivenOwnerHasGroupOrderWithGuestCarts(Table table)
    {
        var carts = table.Rows.Select(row => new GroupOrderGuestCart(
            row["name"], int.Parse(row["quantity"], CultureInfo.InvariantCulture))).ToArray();
        return Actor.AttemptsToAsync(new SetUpGroupOrder(carts));
    }

    [Given("the Owner has a group order with no guests")]
    public Task GivenOwnerHasAnEmptyGroupOrder() => Actor.AttemptsToAsync(new SetUpGroupOrder([]));

    [When("the Owner opens the group review")]
    public async Task WhenOwnerOpensGroupReview()
    {
        var config = GroupOrderTestConfiguration.RequireDedicatedEnvironment(Settings.Current);
        await Actor.AttemptsToAsync(new SignInThroughTheLoginForm(config.OwnerUsername, config.OwnerPassword));
        await Actor.AttemptsToAsync(new OpenGroupOrderReview());
    }

    [When("a guest adds one more portion and the Owner refreshes the group review")]
    public async Task WhenGuestChangesCartAndOwnerRefreshes()
    {
        await Actor.AttemptsToAsync(new ChangeGroupGuestCart(0, 1));
        await new GroupOrderReviewPage(Actor.LookingAtThePage()).RefreshAsync();
    }

    [Then("all prepared guests, dishes, quantities and individual totals are displayed")]
    public async Task ThenAllPreparedGuestsAndCartsAreDisplayed()
    {
        var fixture = Recall<GroupOrderFixture>();
        var snapshot = await Actor.AsksForAsync(new TheGroupOrderReview());
        await Assert.That(snapshot.Participants.Count == fixture.Guests.Count)
            .IsTrue().Because($"participant cards were: {string.Join(" | ", snapshot.Participants.Select(person => person.Heading))}");

        foreach (var guest in fixture.Guests)
        {
            var participant = snapshot.Participants.SingleOrDefault(person => person.Heading.Contains(guest.Name, StringComparison.Ordinal));
            await Assert.That(participant is not null).IsTrue().Because($"no card was shown for {guest.Name}");
            await Assert.That(participant!.Status).IsEqualTo("Still choosing");
            var expectedTotal = fixture.Dish.Price * guest.Quantity;
            await Assert.That(participant.Total == expectedTotal)
                .IsTrue().Because($"{guest.Name} total was {participant.Total}; expected {expectedTotal}");

            if (guest.Quantity == 0)
            {
                await Assert.That(participant.EmptyMessage).IsEqualTo("No dishes yet");
                await Assert.That(participant.Dishes.Count == 0).IsTrue();
            }
            else
            {
                await Assert.That(participant.Dishes.Count == 1).IsTrue();
                await Assert.That(participant.Dishes[0].Name).IsEqualTo(fixture.Dish.Name);
                await Assert.That(participant.Dishes[0].Quantity == guest.Quantity).IsTrue();
            }
        }
    }

    [Then("the group total equals the sum of participant totals")]
    public async Task ThenGroupTotalEqualsParticipantTotals()
    {
        var snapshot = await Actor.AsksForAsync(new TheGroupOrderReview());
        var participantTotal = snapshot.Participants.Sum(participant => participant.Total);
        await Assert.That(snapshot.GrandTotal == participantTotal)
            .IsTrue().Because($"Grand Total was {snapshot.GrandTotal}; participant totals sum to {participantTotal}");
    }

    [Then("the group total reflects the changed guest cart")]
    public async Task ThenGroupTotalReflectsCartChange()
    {
        var fixture = Recall<GroupOrderFixture>();
        var snapshot = await Actor.AsksForAsync(new TheGroupOrderReview());
        var guest = fixture.Guests[0];
        var participant = snapshot.Participants.SingleOrDefault(person => person.Heading.Contains(guest.Name, StringComparison.Ordinal));
        var expectedTotal = fixture.Dish.Price * guest.Quantity;
        await Assert.That(participant is not null).IsTrue().Because($"no card was shown for {guest.Name}");
        await Assert.That(participant!.Total == expectedTotal)
            .IsTrue().Because($"guest total was {participant.Total}; expected {expectedTotal}");
        await Assert.That(snapshot.GrandTotal == snapshot.Participants.Sum(person => person.Total))
            .IsTrue().Because($"Grand Total was {snapshot.GrandTotal}; participant totals sum to {snapshot.Participants.Sum(person => person.Total)}");
    }

    [Then("the group review has no participants and a total of zero")]
    public async Task ThenGroupReviewIsEmpty()
    {
        var snapshot = await Actor.AsksForAsync(new TheGroupOrderReview());
        await Assert.That(snapshot.Participants.Count == 0).IsTrue();
        await Assert.That(snapshot.GrandTotal == 0m).IsTrue().Because($"Grand Total was {snapshot.GrandTotal}");
    }

    [When("the {string} requests the participant list")]
    public Task WhenPersonaRequestsParticipants(string persona) =>
        Actor.AttemptsToAsync(new RequestGroupSessionsAs(persona));

    [When("the Owner requests a nonexistent group's participant list")]
    public Task WhenOwnerRequestsMissingGroup() =>
        Actor.AttemptsToAsync(new RequestGroupSessionsAs("owner", useMissingGroup: true));

    [Then("access is denied with the expected authorization response")]
    public async Task ThenAccessIsDenied()
    {
        var attempt = Recall<GroupOrderAccessAttempt>();
        var outcome = await Actor.AsksForAsync(new TheOutcome());
        await Assert.That(outcome.Status == attempt.ExpectedStatus)
            .IsTrue().Because($"{attempt.Persona} received HTTP {outcome.Status}: {outcome.Body}");
    }

    [Then("the group is reported as not found")]
    public async Task ThenGroupIsNotFound()
    {
        var outcome = await Actor.AsksForAsync(new TheOutcome());
        await Assert.That(outcome.Status == 404).IsTrue().Because($"response body was: {outcome.Body}");
    }
}
