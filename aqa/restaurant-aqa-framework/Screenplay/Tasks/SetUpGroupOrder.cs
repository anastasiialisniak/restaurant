using Restaurant_Aqa_Framework.Api;
using Restaurant_Aqa_Framework.Api.Dtos.Auth;
using Restaurant_Aqa_Framework.Api.Dtos.Dishes;
using Restaurant_Aqa_Framework.Api.Dtos.GroupOrders;
using Restaurant_Aqa_Framework.Api.Dtos.Reservations;
using Restaurant_Aqa_Framework.Api.Seeding;
using Restaurant_Aqa_Framework.Configuration;
using Restaurant_Aqa_Framework.Contexts;

namespace Restaurant_Aqa_Framework.Screenplay.Tasks;

/// <summary>Creates a unique owner reservation and guest carts through the API for an L1 UI/API scenario.</summary>
public sealed class SetUpGroupOrder(IReadOnlyList<GroupOrderGuestCart>? guestCarts = null) : ITask
{
    public async Task PerformAsAsync(Actor actor)
    {
        var settings = Settings.Current;
        var fixtureSettings = GroupOrderTestConfiguration.RequireDedicatedEnvironment(settings);
        var api = actor.UsingTheApi();
        var lastResponse = actor.TheLastResponse();
        var reservationsApi = new ReservationsApi(api);
        var groupsApi = new GroupOrdersApi(api);
        var guestsApi = new GuestSessionsApi(api);
        var cleanup = actor.Recall<CleanupScope>();

        await lastResponse.CaptureAsync(await new AuthApi(api).SignInAsync(
            new SignInRequest(fixtureSettings.OwnerUsername, fixtureSettings.OwnerPassword)));
        EnsureSuccess(lastResponse, "signing in the dedicated Owner account");
        var ownerToken = lastResponse.Json<SignInResponse>().IdToken;

        var dishResponse = await new DishesApi(api).GetDishAsync(fixtureSettings.DishId);
        await lastResponse.CaptureAsync(dishResponse);
        EnsureSuccess(lastResponse, "loading the configured group-order test dish");
        var sourceDish = lastResponse.Json<DishResponse>();
        if (!string.Equals(sourceDish.State, "Available", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("GROUP_ORDER_TEST_DISH_ID must identify an available dish in the test environment.");

        var carts = guestCarts ?? [new GroupOrderGuestCart("Guest", 2), new GroupOrderGuestCart("Guest", 0)];
        if (carts.Any(cart => cart.Quantity < 0))
            throw new InvalidOperationException("Guest cart quantities cannot be negative.");

        var startTime = DateTime.UtcNow.AddDays(2).AddMinutes(Random.Shared.Next(0, 7 * 24 * 60));
        await lastResponse.CaptureAsync(await reservationsApi.CreateReservationAsync(
            new CreateReservationRequest(fixtureSettings.TableId, startTime, startTime.AddHours(1), Math.Max(2, carts.Count + 1)), ownerToken));
        EnsureSuccess(lastResponse, "creating the unique group-order test reservation");
        var reservation = lastResponse.Json<ReservationResponse>();
        cleanup.TrackDelete($"group-order reservation:{reservation.Id}", () => reservationsApi.CancelReservationAsync(reservation.Id, ownerToken));

        await lastResponse.CaptureAsync(await groupsApi.GetInviteTokenAsync(reservation.Id, ownerToken));
        EnsureSuccess(lastResponse, "retrieving the reservation's group invite");
        var inviteToken = lastResponse.Json<GroupInviteToken>().Token;

        await lastResponse.CaptureAsync(await groupsApi.GetInviteAsync(inviteToken));
        EnsureSuccess(lastResponse, "loading group invite details");
        var invite = lastResponse.Json<GroupInvite>();

        await lastResponse.CaptureAsync(await groupsApi.GetOwnerSessionIdAsync(reservation.Id, ownerToken));
        EnsureSuccess(lastResponse, "retrieving the Owner guest session");
        var ownerSession = lastResponse.Json<OwnerGuestSessionId>();

        var guests = new List<GroupOrderFixtureGuest>();
        var runId = Guid.NewGuid().ToString("N");
        for (var index = 0; index < carts.Count; index++)
        {
            var guestName = $"AQA-Sample-Group-{runId}-{carts[index].Name}-{index + 1}";
            await lastResponse.CaptureAsync(await guestsApi.CreateAsync(invite.GroupReservationId, guestName));
            EnsureSuccess(lastResponse, $"creating group guest {index + 1}");
            var guest = lastResponse.Json<CreateGuestSessionResponse>();
            cleanup.TrackDelete($"group-order guest:{guest.SessionId}", () => groupsApi.RemoveGuestAsync(
                invite.GroupReservationId, guest.SessionId, ownerToken));

            if (carts[index].Quantity > 0)
            {
                await lastResponse.CaptureAsync(await guestsApi.AddDishAsync(
                    guest.SessionId, guest.SessionToken, sourceDish.Id, carts[index].Quantity));
                EnsureSuccess(lastResponse, $"adding the configured dish to group guest {index + 1}");
            }

            guests.Add(new GroupOrderFixtureGuest(guestName, guest.SessionId, guest.SessionToken, carts[index].Quantity));
        }

        var fixture = new GroupOrderFixture(
            reservation.Id,
            invite.GroupReservationId,
            ownerToken,
            ownerSession.GuestSessionId,
            new GroupDish(sourceDish.Id, sourceDish.Name, sourceDish.Price),
            guests);
        actor.Remember(fixture);
    }

    private static void EnsureSuccess(ApiResponseContext response, string operation)
    {
        if (!response.Succeeded)
            throw new InvalidOperationException($"Test fixture setup failed while {operation}: HTTP {response.Status}: {response.Body}");
    }
}
