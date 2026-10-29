using System.Text.Json.Serialization;

namespace APIHandler.Models.GuestSessions;

public class SubmitGroupReservationRequest
{
    [JsonPropertyName("reservationId")]
    public required string ReservationId { get; set; }
}
