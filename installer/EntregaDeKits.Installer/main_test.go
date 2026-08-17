package main

import (
	"path/filepath"
	"testing"
)

func TestSafeArchiveTargetAcceptsFileInsideDestination(t *testing.T) {
	destination := t.TempDir()
	target, err := safeArchiveTarget(destination, "pt-BR/arquivo.dll")
	if err != nil {
		t.Fatalf("caminho válido recusado: %v", err)
	}

	want := filepath.Join(destination, "pt-BR", "arquivo.dll")
	if target != want {
		t.Fatalf("destino = %q; esperado %q", target, want)
	}
}

func TestPsSingleQuoteEscapesEmbeddedQuotes(t *testing.T) {
	got := psSingleQuote(`C:\Users\O'Brien\Desktop\Entrega de Kits CHIPOWER.lnk`)
	want := `'C:\Users\O''Brien\Desktop\Entrega de Kits CHIPOWER.lnk'`
	if got != want {
		t.Fatalf("psSingleQuote = %q; esperado %q", got, want)
	}
}

func TestSafeArchiveTargetRejectsTraversal(t *testing.T) {
	destination := t.TempDir()
	for _, name := range []string{"../fora.txt", "pasta/../../fora.txt", "C:/fora.txt"} {
		if _, err := safeArchiveTarget(destination, name); err == nil {
			t.Fatalf("caminho perigoso aceito: %q", name)
		}
	}
}
