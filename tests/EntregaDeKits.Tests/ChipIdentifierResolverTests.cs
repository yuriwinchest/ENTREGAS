using EntregaDeKits.Core;

namespace EntregaDeKits.Tests;

public sealed class ChipIdentifierResolverTests
{
    private readonly ChipIdentifierResolver _resolver = new();

    [Fact]
    public void Preserves_exact_normalized_epc_candidate() => Assert.Contains("ABC-123", _resolver.GetCandidates(" abc-123 "));

    [Fact]
    public void Converts_complete_hex_epc_to_decimal() => Assert.Contains("51921", _resolver.GetCandidates("00000000000000000000CAD1"));

    [Fact]
    public void Does_not_convert_partial_hex_as_decimal() => Assert.DoesNotContain("51921", _resolver.GetCandidates("CAD1"));

    [Fact]
    public void Accepts_ascii_only_when_clean_identifier() => Assert.Contains("CHIP-0000007", _resolver.GetCandidates("434849502D30303030303037"));
}
