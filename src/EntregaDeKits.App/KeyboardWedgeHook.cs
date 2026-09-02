using System.Windows;
using System.Windows.Input;
using EntregaDeKits.Core;
using KeyEventArgs = System.Windows.Input.KeyEventArgs;
using TextBox = System.Windows.Controls.TextBox;
using PasswordBox = System.Windows.Controls.PasswordBox;

namespace EntregaDeKits.App;

/// <summary>
/// Liga o teclado de uma janela ao <see cref="KeyboardWedgeDecoder"/>.
///
/// A leitora de mesa se apresenta como teclado, então não há dispositivo para
/// abrir nem porta para configurar: basta escutar as teclas da janela que está
/// em foco. Como o telão pode estar destacado na televisão enquanto a operadora
/// trabalha na janela principal, CADA janela precisa do seu próprio gancho —
/// a leitora digita em quem estiver com o foco, e ninguém sabe qual será.
///
/// Os caracteres chegam por PreviewTextInput e o Enter por PreviewKeyDown,
/// porque PreviewTextInput não dispara para Enter. Os dois são eventos de
/// túnel: a tecla passa por aqui ANTES de chegar a qualquer campo da tela.
/// </summary>
public sealed class KeyboardWedgeHook : IDisposable
{
    private readonly Window _window;
    private readonly Func<bool> _isArmed;
    private readonly Action<string> _onCode;
    private readonly KeyboardWedgeDecoder _decoder = new();
    private bool _disposed;

    public KeyboardWedgeHook(Window window, Func<bool> isArmed, Action<string> onCode)
    {
        _window = window;
        _isArmed = isArmed;
        _onCode = onCode;
        _window.PreviewTextInput += OnTextInput;
        _window.PreviewKeyDown += OnKeyDown;
    }

    /// <summary>
    /// Um campo de texto em foco desarma a captura. Sem isto, digitar o nome de
    /// um corredor na busca alimentaria o decodificador e a leitora engoliria
    /// as teclas de quem está digitando.
    /// </summary>
    public static bool IsTypingInAField()
        => Keyboard.FocusedElement is TextBox or PasswordBox;

    private void OnTextInput(object sender, TextCompositionEventArgs eventArgs)
    {
        if (!Armed()) return;

        foreach (var character in eventArgs.Text)
        {
            if (char.IsControl(character)) continue;
            _decoder.Feed(character, DateTimeOffset.Now);
        }

        // A tecla não segue adiante: com a captura armada nenhum campo da tela
        // deveria receber o que a leitora está digitando.
        eventArgs.Handled = true;
    }

    private void OnKeyDown(object sender, KeyEventArgs eventArgs)
    {
        if (eventArgs.Key is not (Key.Enter or Key.Return)) return;
        if (!Armed()) return;

        var code = _decoder.Submit(DateTimeOffset.Now);
        if (code is null) return;

        // Sem isto, o Enter da leitora acionaria o botão que estiver em foco.
        eventArgs.Handled = true;
        _onCode(code);
    }

    private bool Armed()
    {
        if (_disposed) return false;
        if (IsTypingInAField()) { _decoder.Reset(); return false; }
        return _isArmed();
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _window.PreviewTextInput -= OnTextInput;
        _window.PreviewKeyDown -= OnKeyDown;
    }
}
