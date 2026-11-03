using Restaurant_Aqa_Framework.Api;
using Restaurant_Aqa_Framework.Api.Dtos.Auth;
using Restaurant_Aqa_Framework.Api.Dtos.GroupOrders;
using Restaurant_Aqa_Framework.Configuration;

namespace Restaurant_Aqa_Framework.Screenplay.Tasks;

/// <summary>Attempts the Owner-only participant read using one of the configured personas.</summary>
public sealed class RequestGroupSessionsAs(string persona, bool useMissingGroup = false) : ITask
{
    public async Task PerformAsAsync(Actor actor)
    {
        var settings = Settings.Current;
        var fixtureSettings = GroupOrderTestConfiguration.RequireDedicatedEnvironment(settings);
        var fixture = actor.Recall<GroupOrderFixture>();
        var token = await ResolveTokenAsync(actor, persona, fixture, fixtureSettings);
        var groupId = useMissingGroup ? Guid.NewGuid().ToString() : fixture.GroupReservationId;

        await actor.TheLastResponse().CaptureAsync(await new GroupOrdersApi(actor.UsingTheApi())
            .GetSessionsAsync(groupId, token));

        var expectedStatus = persona switch
        {
            "another customer" or "waiter" => 403,
            "guest" or "unauthenticated visitor" => 401,
            "owner" => 200,
            _ => throw new InvalidOperationException($"Unsupported group-order test persona '{persona}'."),
        };
        actor.Remember(new GroupOrderAccessAttempt(persona, useMissingGroup ? 404 : expectedStatus));
    }

    private static async Task<string?> ResolveTokenAsync(
        Actor actor,
        string persona,
        GroupOrderFixture fixture,
        GroupOrderTestConfiguration settings)
    {
        if (persona == "owner")
            return fixture.OwnerToken;
        if (persona == "unauthenticated visitor")
            return null;
        if (persona == "guest")
        {
            var guest = fixture.Guests.Count > 0
                ? fixture.Guests[0]
                : throw new InvalidOperationException("The guest-denial scenario requires a seeded guest session.");
            return guest.SessionToken;
        }

        var credentials = persona switch
        {
            "another customer" => (settings.OtherCustomerUsername, settings.OtherCustomerPassword),
            "waiter" => (settings.WaiterUsername, settings.WaiterPassword),
            _ => throw new InvalidOperationException($"Unsupported group-order test persona '{persona}'."),
        };

        var response = await new AuthApi(actor.UsingTheApi()).SignInAsync(new SignInRequest(credentials.Item1, credentials.Item2));
        await actor.TheLastResponse().CaptureAsync(response);
        if (!actor.TheLastResponse().Succeeded)
            throw new InvalidOperationException($"The dedicated '{persona}' test account could not sign in (HTTP {actor.TheLastResponse().Status}).");

        return actor.TheLastResponse().Json<SignInResponse>().IdToken;
    }
}
