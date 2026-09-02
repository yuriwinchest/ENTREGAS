namespace EntregaDeKits.Core;

/// <summary>Resultado de uma passagem: o código lido e o corredor a que ele corresponde.</summary>
public sealed record PassageRead(
    string Code,
    Participant? Runner,
    IReadOnlyList<string> TriedKeys,
    DateTimeOffset At)
{
    public bool Found => Runner is not null;
}

/// <summary>
/// A operação de passagem: uma lista na memória e o que o telão está mostrando.
///
/// POR QUE NÃO USA O BANCO: aqui não se entrega kit nem se audita nada. O
/// corredor passa em frente à leitora e o telão mostra quem ele é. A lista vem
/// da planilha que a operadora anexa e morre quando o programa fecha — sem
/// SQLite, sem migração, sem o aviso de "isto vai apagar as entregas". O balcão
/// continua com o banco dele, intocado.
///
/// PRIVACIDADE: CPF e data de nascimento existem no <see cref="Participant"/>,
/// mas o <see cref="DisplayModel"/> não tem campo para eles — o telão fica
/// exposto ao público e esses dois dados nunca podem chegar lá.
/// </summary>
public sealed class PassageSession
{
    /// <summary>Enquanto a etiqueta está no campo da antena a leitora repete sem parar.
    /// Dentro desta janela a repetição é contada, mas não troca o que está no telão.</summary>
    private static readonly TimeSpan RepeatWindow = TimeSpan.FromSeconds(3);

    private readonly Dictionary<string, Participant> _byKey = new(StringComparer.Ordinal);
    private readonly List<string> _ambiguousKeys = [];
    private IReadOnlyList<Participant> _roster = [];

    public TagCaptureLog Capture { get; } = new();
    public string? SourceFile { get; private set; }
    public PassageRead? Last { get; private set; }

    public int RosterCount => _roster.Count;
    public bool HasRoster => _roster.Count > 0;

    /// <summary>Chips que apareceram em mais de um corredor e por isso não são confiáveis.</summary>
    public IReadOnlyList<string> AmbiguousKeys => _ambiguousKeys;

    public event EventHandler? Changed;

    public void LoadRoster(string sourceFile, IEnumerable<Participant> people)
    {
        _roster = people.ToArray();
        SourceFile = sourceFile;
        Last = null;
        Capture.Clear();
        BuildIndex();
        Changed?.Invoke(this, EventArgs.Empty);
    }

    /// <summary>
    /// Indexa cada corredor por TODAS as escritas plausíveis do CHIP e do número.
    /// Uma chave reivindicada por dois corredores diferentes é descartada: é
    /// melhor não achar ninguém do que anunciar o corredor errado no telão.
    /// </summary>
    private void BuildIndex()
    {
        _byKey.Clear();
        _ambiguousKeys.Clear();
        var conflicting = new HashSet<string>(StringComparer.Ordinal);

        foreach (var person in _roster)
        {
            foreach (var key in KeysOf(person))
            {
                if (_byKey.TryGetValue(key, out var existing))
                {
                    if (!ReferenceEquals(existing, person)) conflicting.Add(key);
                    continue;
                }
                _byKey[key] = person;
            }
        }

        foreach (var key in conflicting) _byKey.Remove(key);
        _ambiguousKeys.AddRange(conflicting.OrderBy(key => key, StringComparer.Ordinal));
    }

    private static IEnumerable<string> KeysOf(Participant person)
        => PassageKeys.Variants(person.Chip).Concat(PassageKeys.Variants(person.Number));

    /// <summary>Procura sem registrar nada — usado por testes e diagnósticos.</summary>
    public PassageRead Resolve(string code, DateTimeOffset at)
    {
        var tried = PassageKeys.Variants(code);
        var runner = tried.Select(key => _byKey.GetValueOrDefault(key)).FirstOrDefault(found => found is not null);
        return new PassageRead(PassageKeys.Normalize(code), runner, tried, at);
    }

    /// <summary>Uma passagem em frente à leitora.</summary>
    public PassageRead Read(string code, DateTimeOffset at)
    {
        var result = Resolve(code, at);
        Capture.Register(result.Code, at);

        // Repetição da mesma etiqueta não redesenha o telão: só a contagem sobe.
        var isRepeat = Last is not null
            && string.Equals(Last.Code, result.Code, StringComparison.Ordinal)
            && at - Last.At < RepeatWindow;

        if (!isRepeat) Last = result;
        Changed?.Invoke(this, EventArgs.Empty);
        return result;
    }

    public void ClearCapture()
    {
        Capture.Clear();
        Last = null;
        Changed?.Invoke(this, EventArgs.Empty);
    }

    /// <summary>O que o telão deve estar mostrando neste instante.</summary>
    public DisplayModel Display
    {
        get
        {
            if (!HasRoster)
                return Last is null
                    ? new DisplayModel("ANEXE A LISTA", "Nenhuma lista carregada", "", "", "", "", "",
                        "Anexe a planilha dos inscritos na aba PASSAGEM para começar.")
                    // A etiqueta foi lida antes da lista existir. Mostrar o
                    // código mesmo assim é o que revela o que a leitora emite.
                    : new DisplayModel("ANEXE A LISTA", Last.Code, "", "", "", "", "",
                        "Etiqueta lida, mas nenhuma lista foi anexada ainda.");

            if (Last is null)
                return new DisplayModel("APROXIME O CHIP", "Aguardando corredor", "", "", "", "", "",
                    $"{RosterCount} inscritos carregados{FileSuffix}");

            if (Last.Runner is null)
                return new DisplayModel("CHIP FORA DA LISTA", Last.Code, "", "", "", "", "",
                    "Esta etiqueta não corresponde a nenhum inscrito da lista carregada.");

            var runner = Last.Runner;
            return new DisplayModel(
                "CORREDOR IDENTIFICADO",
                runner.Name,
                runner.Number,
                runner.Chip,
                runner.Shirt ?? "—",
                runner.Modality ?? "—",
                runner.Category ?? "—",
                $"Leitura às {Last.At:HH:mm:ss}");
        }
    }

    private string FileSuffix => string.IsNullOrWhiteSpace(SourceFile) ? "" : $" • {SourceFile}";
}
