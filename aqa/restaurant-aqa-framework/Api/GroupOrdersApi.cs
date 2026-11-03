using Microsoft.Playwright;
using Restaurant_Aqa_Framework.Api.Dtos.GroupOrders;

namespace Restaurant_Aqa_Framework.Api;

/// <summary>Owner review, group invites, and the guest-session operations needed to seed L1 fixtures.</summary>
public sealed class GroupOrdersApi(IAPIRequestContext api) : ApiClientBase(api)
{
    public Task<IAPIResponse> GetInviteTokenAsync(string reservationId, string ownerToken) =>
        GetAsync(Url($"/reservations/{Uri.EscapeDataString(reservationId)}/invite-token"),
            new APIRequestContextOptions { Headers = Headers(ownerToken) });

    public Task<IAPIResponse> GetInviteAsync(string token) =>
        GetAsync(Url($"/guest/invites/{Uri.EscapeDataString(token)}"));

    public Task<IAPIResponse> GetOwnerSessionIdAsync(string reservationId, string ownerToken) =>
        GetAsync(Url($"/reservations/{Uri.EscapeDataString(reservationId)}/guest-session-id"),
            new APIRequestContextOptions { Headers = Headers(ownerToken) });

    public Task<IAPIResponse> GetSessionsAsync(string groupReservationId, string? bearerToken) =>
        GetAsync(Url($"/guest/groups/{Uri.EscapeDataString(groupReservationId)}/sessions"),
            new APIRequestContextOptions { Headers = Headers(bearerToken) });

    public Task<IAPIResponse> RemoveGuestAsync(string groupReservationId, string guestSessionId, string ownerToken) =>
        DeleteAsync(Url($"/guest/groups/{Uri.EscapeDataString(groupReservationId)}/sessions/{Uri.EscapeDataString(guestSessionId)}"),
            new APIRequestContextOptions { Headers = Headers(ownerToken) });
}
