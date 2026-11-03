namespace Restaurant_Aqa_Framework.Api.Dtos.GroupOrders;

public sealed record GroupInviteToken(string Token);

public sealed record GroupInvite(
    string GroupReservationId,
    string LocationId,
    string RestaurantName,
    string LocationAddress,
    DateTime StartTime,
    DateTime EndTime,
    int MaxGuestCount,
    int TableNumber,
    string InviterName);

public sealed record OwnerGuestSessionId(string GuestSessionId);

public sealed record CreateGuestSessionRequest(string GroupReservationId, string GuestName);

public sealed record CreateGuestSessionResponse(string SessionId, string SessionToken);

public sealed record GroupSessionsResponse(IReadOnlyList<GroupParticipant> Participants, decimal Total);

public sealed record GroupParticipant(
    string? Id,
    string Type,
    string Name,
    IReadOnlyList<GroupParticipantItem> Items,
    decimal Total,
    bool IsSubmitted);

public sealed record GroupParticipantItem(GroupDish Dish, int Quantity);

public sealed record GroupDish(string Id, string Name, decimal Price);

public sealed record GroupOrderFixtureGuest(string Name, string SessionId, string SessionToken, int Quantity);

public sealed record GroupOrderFixture(
    string ReservationId,
    string GroupReservationId,
    string OwnerToken,
    string OwnerSessionId,
    GroupDish Dish,
    IReadOnlyList<GroupOrderFixtureGuest> Guests);

public sealed record GroupOrderAccessAttempt(string Persona, int ExpectedStatus);

public sealed record GroupOrderGuestCart(string Name, int Quantity);
