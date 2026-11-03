using Microsoft.Playwright;
using Restaurant_Aqa_Framework.Api.Dtos.GroupOrders;

namespace Restaurant_Aqa_Framework.Api;

/// <summary>Unauthenticated guest-session creation and token-authenticated cart setup for L1 fixtures.</summary>
public sealed class GuestSessionsApi(IAPIRequestContext api) : ApiClientBase(api)
{
    public Task<IAPIResponse> CreateAsync(string groupReservationId, string guestName) =>
        Api.PostAsync(Url("/guest/sessions"), new APIRequestContextOptions
        {
            DataString = Serialize(new CreateGuestSessionRequest(groupReservationId, guestName)),
            Headers = Headers(),
        });

    public Task<IAPIResponse> AddDishAsync(string guestSessionId, string guestToken, string dishId, int quantity) =>
        Api.PostAsync(Url($"/guest/sessions/{Uri.EscapeDataString(guestSessionId)}/dishes"), new APIRequestContextOptions
        {
            DataString = Serialize(new { dishId, quantity }),
            Headers = Headers(guestToken),
        });
}
