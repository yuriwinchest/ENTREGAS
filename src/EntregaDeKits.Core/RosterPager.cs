namespace EntregaDeKits.Core;

public static class RosterPager
{
    public const int PageSize = 10;

    public static int PageCount(int total)
        => Math.Max(1, (int)Math.Ceiling(Math.Max(total, 0) / (double)PageSize));

    public static int ClampPage(int page, int total)
        => Math.Clamp(page, 1, PageCount(total));

    public static IReadOnlyList<T> TakePage<T>(IReadOnlyList<T> items, int page)
    {
        var safe = ClampPage(page, items.Count);
        return items.Skip((safe - 1) * PageSize).Take(PageSize).ToArray();
    }
}
