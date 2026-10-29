using System.Text.Json.Serialization;

namespace APIHandler.Models.GuestSessions;

public record ConsolidatedDishResponse(
    [property: JsonPropertyName("dishId")] string DishId,
    [property: JsonPropertyName("quantity")] int Quantity);
