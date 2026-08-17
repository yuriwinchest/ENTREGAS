package main

import (
	"archive/zip"
	"bytes"
	_ "embed"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

const version = "0.3.3"

//go:embed payload.zip
var payload []byte

func main() {
	productRoot, err := localProductRoot()
	if err != nil {
		showError(err)
		return
	}

	installDir := filepath.Join(productRoot, "app", version)
	stagingDir := filepath.Join(productRoot, ".install-"+newStagingID())
	defer os.RemoveAll(stagingDir)

	if err := install(stagingDir, installDir); err != nil {
		_ = os.MkdirAll(productRoot, 0o755)
		_ = os.WriteFile(filepath.Join(productRoot, "instalacao-erro.txt"), []byte(err.Error()), 0o600)
		showError(err)
		return
	}

	executable := filepath.Join(installDir, "EntregaDeKits.exe")
	_ = createAppShortcuts(executable)

	command := exec.Command(executable)
	command.Dir = installDir
	if err := command.Start(); err != nil {
		showError(fmt.Errorf("o sistema foi instalado, mas não pôde ser aberto: %w", err))
	}
}

func install(stagingDir, installDir string) error {
	if err := os.MkdirAll(stagingDir, 0o755); err != nil {
		return fmt.Errorf("não foi possível preparar a instalação: %w", err)
	}

	if err := extractPayload(stagingDir); err != nil {
		return err
	}

	stagedExecutable := filepath.Join(stagingDir, "EntregaDeKits.exe")
	if _, err := os.Stat(stagedExecutable); err != nil {
		return fmt.Errorf("o pacote não contém o executável principal: %w", err)
	}

	if err := copyTree(stagingDir, installDir); err != nil {
		return fmt.Errorf("não foi possível copiar os arquivos do sistema: %w", err)
	}

	return nil
}

func extractPayload(destination string) error {
	reader, err := zip.NewReader(bytes.NewReader(payload), int64(len(payload)))
	if err != nil {
		return fmt.Errorf("o pacote interno está inválido: %w", err)
	}

	for _, entry := range reader.File {
		target, err := safeArchiveTarget(destination, entry.Name)
		if err != nil {
			return err
		}

		if entry.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}

		if err := extractFile(entry, target); err != nil {
			return err
		}
	}

	return nil
}

func safeArchiveTarget(destination, name string) (string, error) {
	cleanName := filepath.Clean(filepath.FromSlash(name))
	if filepath.IsAbs(cleanName) || filepath.VolumeName(cleanName) != "" || cleanName == ".." || strings.HasPrefix(cleanName, ".."+string(os.PathSeparator)) {
		return "", fmt.Errorf("caminho inválido no pacote: %s", name)
	}

	target := filepath.Join(destination, cleanName)
	relative, err := filepath.Rel(destination, target)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(os.PathSeparator)) {
		return "", fmt.Errorf("caminho fora da instalação: %s", name)
	}

	return target, nil
}

func extractFile(entry *zip.File, target string) error {
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}

	source, err := entry.Open()
	if err != nil {
		return err
	}
	defer source.Close()

	destination, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}

	_, copyErr := io.Copy(destination, source)
	closeErr := destination.Close()
	return errors.Join(copyErr, closeErr)
}

func copyTree(source, destination string) error {
	return filepath.WalkDir(source, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		relative, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		target := filepath.Join(destination, relative)

		if entry.IsDir() {
			return os.MkdirAll(target, 0o755)
		}

		return copyFile(path, target)
	})
}

func copyFile(source, destination string) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
		_ = input.Close()
		return err
	}
	output, err := os.OpenFile(destination, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
	if err != nil {
		_ = input.Close()
		return err
	}

	_, copyErr := io.Copy(output, input)
	inputCloseErr := input.Close()
	outputCloseErr := output.Close()
	return errors.Join(copyErr, inputCloseErr, outputCloseErr)
}

const shortcutName = "Entrega de Kits CHIPOWER"

func createAppShortcuts(executable string) error {
	desktop, err := desktopDir()
	if err == nil {
		_ = os.Remove(filepath.Join(desktop, shortcutName+".url"))
		if err := createWindowsShortcut(filepath.Join(desktop, shortcutName+".lnk"), executable); err != nil {
			return err
		}
	}

	startMenu := filepath.Join(os.Getenv("APPDATA"), "Microsoft", "Windows", "Start Menu", "Programs", "CHIPOWER")
	if err := os.MkdirAll(startMenu, 0o755); err != nil {
		return err
	}
	return createWindowsShortcut(filepath.Join(startMenu, shortcutName+".lnk"), executable)
}

func desktopDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	for _, candidate := range []string{
		filepath.Join(home, "Desktop"),
		filepath.Join(home, "OneDrive", "Desktop"),
	} {
		if info, statErr := os.Stat(candidate); statErr == nil && info.IsDir() {
			return candidate, nil
		}
	}
	return "", errors.New("pasta da área de trabalho não encontrada")
}

func psSingleQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "''") + "'"
}

func createWindowsShortcut(shortcutPath, executable string) error {
	if err := os.MkdirAll(filepath.Dir(shortcutPath), 0o755); err != nil {
		return err
	}

	script := strings.Join([]string{
		"$ws = New-Object -ComObject WScript.Shell",
		"$s = $ws.CreateShortcut(" + psSingleQuote(shortcutPath) + ")",
		"$s.TargetPath = " + psSingleQuote(executable),
		"$s.WorkingDirectory = " + psSingleQuote(filepath.Dir(executable)),
		"$s.IconLocation = " + psSingleQuote(shortcutIcon(executable)),
		"$s.Description = " + psSingleQuote(shortcutName),
		"$s.Save()",
	}, "; ")

	command := exec.Command("powershell.exe", "-NoProfile", "-STA", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script)
	command.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := command.CombinedOutput()
	if err != nil {
		return fmt.Errorf("não foi possível criar o atalho: %w (%s)", err, strings.TrimSpace(string(output)))
	}
	return nil
}

func shortcutIcon(executable string) string {
	sidecar := filepath.Join(filepath.Dir(executable), "chipower.ico")
	if _, err := os.Stat(sidecar); err == nil {
		return sidecar + ",0"
	}
	return executable + ",0"
}

func localProductRoot() (string, error) {
	localAppData := os.Getenv("LOCALAPPDATA")
	if strings.TrimSpace(localAppData) == "" {
		return "", errors.New("a pasta local do Windows não foi encontrada")
	}
	return filepath.Join(localAppData, "Chipower", "EntregaDeKits"), nil
}

func newStagingID() string {
	file, err := os.CreateTemp("", "chipower-id-")
	if err != nil {
		return fmt.Sprintf("%d", os.Getpid())
	}
	name := filepath.Base(file.Name())
	_ = file.Close()
	_ = os.Remove(file.Name())
	return strings.TrimPrefix(name, "chipower-id-")
}

func showError(err error) {
	message := "Não foi possível instalar o Entrega de Kits.\n\nDetalhes: " + err.Error()
	user32 := syscall.NewLazyDLL("user32.dll")
	messageBox := user32.NewProc("MessageBoxW")
	text, _ := syscall.UTF16PtrFromString(message)
	title, _ := syscall.UTF16PtrFromString("Entrega de Kits CHIPOWER")
	_, _, _ = messageBox.Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0x10)
}
