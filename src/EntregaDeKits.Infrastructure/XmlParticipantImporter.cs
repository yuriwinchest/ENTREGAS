using System.Xml;
using System.Xml.Linq;
using EntregaDeKits.Core;

namespace EntregaDeKits.Infrastructure;

public sealed class XmlParticipantImporter
{
    public (IReadOnlyList<Participant> Participants, ImportReport Report) Read(string path)
    {
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        var settings = new XmlReaderSettings
        {
            DtdProcessing = DtdProcessing.Prohibit,
            XmlResolver = null,
            IgnoreComments = true,
            IgnoreWhitespace = true
        };
        using var reader = XmlReader.Create(stream, settings);
        var document = XDocument.Load(reader, LoadOptions.None);
        if (document.Root is null) throw new InvalidDataException("O XML não possui elemento raiz.");

        var rows = new List<IReadOnlyList<string>>();
        var headers = new List<string>();
        CollectRecords(document.Root, rows, headers);
        if (rows.Count == 0) throw new InvalidDataException("O XML não contém corredores com nome e número.");
        return TabularParticipantParser.Parse(rows);
    }

    private static void CollectRecords(XElement element, List<IReadOnlyList<string>> rows, List<string> headers)
    {
        var leaves = element.Elements().Where(child => !child.HasElements).ToList();
        var attributes = element.Attributes().Where(attribute => attribute.Name.LocalName is not "xmlns").ToList();
        var pairs = leaves.Select(leaf => (Name: leaf.Name.LocalName, Value: leaf.Value))
            .Concat(attributes.Select(attribute => (Name: attribute.Name.LocalName, Value: attribute.Value)))
            .ToList();

        if (pairs.Count > 0)
        {
            var names = pairs.Select(pair => pair.Name).ToArray();
            var map = ParticipantFieldMap.MapColumns(names);
            if (ParticipantFieldMap.HasIdentity(map))
            {
                if (headers.Count == 0) headers.AddRange(names);
                if (rows.Count == 0) rows.Add(headers.ToArray());
                var aligned = headers.Select(header =>
                {
                    var match = pairs.FirstOrDefault(pair => NameSearch.Fold(pair.Name) == NameSearch.Fold(header));
                    return match.Name is null ? string.Empty : match.Value.Trim();
                }).ToArray();
                rows.Add(aligned);
            }
        }

        foreach (var child in element.Elements().Where(item => item.HasElements))
            CollectRecords(child, rows, headers);
    }
}
