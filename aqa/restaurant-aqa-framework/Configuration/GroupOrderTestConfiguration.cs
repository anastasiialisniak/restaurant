using dotenv.net.Utilities;

namespace Restaurant_Aqa_Framework.Configuration;

/// <summary>Credentials and seed identifiers for the explicitly disposable group-order environment.</summary>
public sealed record GroupOrderTestConfiguration(
    string OwnerUsername,
    string OwnerPassword,
    string OtherCustomerUsername,
    string OtherCustomerPassword,
    string WaiterUsername,
    string WaiterPassword,
    string TableId,
    string DishId)
{
    public static GroupOrderTestConfiguration RequireDedicatedEnvironment(Settings settings)
    {
        EnvConfig.EnsureLoaded();
        var environment = Required("GROUP_ORDER_TEST_ENVIRONMENT");
        if (!string.Equals(environment, "dedicated-non-production", StringComparison.Ordinal))
            throw new InvalidOperationException(
                "Group-order scenarios require GROUP_ORDER_TEST_ENVIRONMENT=dedicated-non-production. " +
                "Never point these mutating tests at production.");

        var apiUri = new Uri(settings.ApiBaseUrl);
        if (string.Equals(apiUri.Host, "l4m1dwvbxe.execute-api.us-west-2.amazonaws.com", StringComparison.OrdinalIgnoreCase)
            || apiUri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries)
                .Any(segment => segment.Equals("prod", StringComparison.OrdinalIgnoreCase)
                    || segment.Equals("production", StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("Group-order fixture setup refuses the known production API or a production stage.");
        }

        return new GroupOrderTestConfiguration(
            Required("GROUP_ORDER_OWNER_USERNAME"),
            Required("GROUP_ORDER_OWNER_PASSWORD"),
            Required("GROUP_ORDER_OTHER_CUSTOMER_USERNAME"),
            Required("GROUP_ORDER_OTHER_CUSTOMER_PASSWORD"),
            Required("GROUP_ORDER_WAITER_USERNAME"),
            Required("GROUP_ORDER_WAITER_PASSWORD"),
            Required("GROUP_ORDER_TESTTABLE_ID"),
            Required("GROUP_ORDER_TEST_DISH_ID"));
    }

    private static string Required(string name)
    {
        if (EnvReader.TryGetStringValue(name, out var value) && !string.IsNullOrWhiteSpace(value))
            return value;

        throw new InvalidOperationException(
            $"Missing '{name}'. Configure a dedicated non-production group-order test environment in .env or process environment variables.");
    }
}
