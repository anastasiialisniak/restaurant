using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace Restaurant_Aqa_Framework.Ui;

public sealed class GroupOrderReviewPage(IPage page) : BasePage(page)
{
    private ILocator ParticipantCards => Page.Locator("ul.participants app-participant-card article.card");
    private ILocator GrandTotalValue => Page.Locator(".grand-total span").Nth(1);
    public ILocator PageTitle => Page.GetByRole(AriaRole.Heading, new() { Name = "Group Pre-Order", Exact = true });

    public ILocator ParticipantCardFor(string guestName) =>
        ParticipantCards.Filter(new() { HasText = guestName });

    public Task NavigateAsync(string reservationId) =>
        NavigateToAsync($"/reservations/{Uri.EscapeDataString(reservationId)}/group-order");

    public Task RefreshAsync() => Page.GetByRole(AriaRole.Button, new() { Name = "Refresh", Exact = true }).ClickAsync();

    public async Task<GroupOrderReviewSnapshot> ReadSnapshotAsync()
    {
        var cards = new List<GroupOrderParticipantSnapshot>();
        var count = await ParticipantCards.CountAsync();
        for (var index = 0; index < count; index++)
        {
            var card = ParticipantCards.Nth(index);
            var dishRows = card.Locator(".item");
            var items = new List<GroupOrderDishSnapshot>();
            for (var itemIndex = 0; itemIndex < await dishRows.CountAsync(); itemIndex++)
            {
                var row = dishRows.Nth(itemIndex);
                var quantityText = await row.Locator(".qty").InnerTextAsync();
                var quantityMatch = Regex.Match(quantityText, @"\d+");
                if (!quantityMatch.Success)
                    throw new InvalidOperationException($"Could not read a dish quantity from '{quantityText}'.");

                items.Add(new GroupOrderDishSnapshot(
                    (await row.Locator(".name").InnerTextAsync()).Trim(),
                    int.Parse(quantityMatch.Value, CultureInfo.InvariantCulture)));
            }

            var emptyText = await card.Locator(".empty").CountAsync() > 0
                ? (await card.Locator(".empty").InnerTextAsync()).Trim()
                : null;

            cards.Add(new GroupOrderParticipantSnapshot(
                (await card.GetByRole(AriaRole.Heading).InnerTextAsync()).Trim(),
                (await card.Locator(".chip").InnerTextAsync()).Trim(),
                items,
                emptyText,
                ParseCurrency(await card.Locator(".subtotal span").Nth(1).InnerTextAsync())));
        }

        return new GroupOrderReviewSnapshot(cards, ParseCurrency(await GrandTotalValue.InnerTextAsync()));
    }

    private static decimal ParseCurrency(string text)
    {
        var numeric = new string(text.Where(character => char.IsDigit(character) || character is '.' or ',' or '-').ToArray())
            .Replace(",", string.Empty, StringComparison.Ordinal);
        return decimal.Parse(numeric, NumberStyles.Number, CultureInfo.InvariantCulture);
    }
}

public sealed record GroupOrderReviewSnapshot(
    IReadOnlyList<GroupOrderParticipantSnapshot> Participants,
    decimal GrandTotal);

public sealed record GroupOrderParticipantSnapshot(
    string Heading,
    string Status,
    IReadOnlyList<GroupOrderDishSnapshot> Dishes,
    string? EmptyMessage,
    decimal Total);

public sealed record GroupOrderDishSnapshot(string Name, int Quantity);
