namespace APIHandler.Models.GuestSessions;

public record CreatGuestSessionResponse(string SessionId, string SessionToken);

public record GuestSessionIdResponse(string GuestSessionId);
