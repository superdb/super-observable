//go:build js && wasm

// Pont SuperDB → JavaScript pour Observable Framework.
//
// Expose globalThis.__superdb :
//
//	register(name, Uint8Array)  rend les octets lisibles par `from name` (persistant)
//	unregister(name)
//	names()                     noms enregistrés
//	run(query, format?)         Promise<Uint8Array> (format par défaut : "bsup")
//	version
package main

import (
	"bytes"
	"context"
	"fmt"
	"io/fs"
	"runtime/debug"
	"sort"
	"sync"
	"syscall/js"

	"github.com/superdb/super"
	"github.com/superdb/super/compiler"
	"github.com/superdb/super/compiler/parser"
	"github.com/superdb/super/pkg/storage"
	"github.com/superdb/super/runtime"
	"github.com/superdb/super/runtime/exec"
	"github.com/superdb/super/sio"
	"github.com/superdb/super/sio/anyio"
	"github.com/superdb/super/vector/vio"
)

var version = "dev"

// engine sert les sources enregistrées depuis la mémoire, avec accès aléatoire
// et taille connue (nécessaires aux trames colonnaires BSUP et à Parquet).
type engine struct {
	*storage.InternalEngine
	mu    sync.RWMutex
	files map[string][]byte // clé : URI normalisée
	names map[string]string // nom donné → clé
}

func newEngine() *engine {
	return &engine{InternalEngine: storage.NewInternalEngine(), files: map[string][]byte{}, names: map[string]string{}}
}

func key(name string) (string, error) {
	u, err := storage.ParseURI(name)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

func (e *engine) add(name string, b []byte) error {
	k, err := key(name)
	if err != nil {
		return err
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	e.files[k] = b
	e.names[name] = k
	return nil
}

func (e *engine) remove(name string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	delete(e.files, e.names[name])
	delete(e.names, name)
}

func (e *engine) lookup(u *storage.URI) ([]byte, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	b, ok := e.files[u.String()]
	return b, ok
}

func (e *engine) Get(_ context.Context, u *storage.URI) (storage.Reader, error) {
	b, ok := e.lookup(u)
	if !ok {
		return nil, fmt.Errorf("%s: %w (sources enregistrées : %v)", u, fs.ErrNotExist, e.list())
	}
	return storage.NewBytesReader(b), nil
}

func (e *engine) Exists(_ context.Context, u *storage.URI) (bool, error) {
	_, ok := e.lookup(u)
	return ok, nil
}

func (e *engine) Size(_ context.Context, u *storage.URI) (int64, error) {
	b, ok := e.lookup(u)
	if !ok {
		return 0, fs.ErrNotExist
	}
	return int64(len(b)), nil
}

func (e *engine) list() []string {
	e.mu.RLock()
	defer e.mu.RUnlock()
	var names []string
	for n := range e.names {
		names = append(names, n)
	}
	sort.Strings(names)
	return names
}

var eng = newEngine()

func run(query, format string) (out []byte, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("panic: %v\n\n%s", r, debug.Stack())
		}
	}()
	ast, err := parser.ParseText(query)
	if err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	sctx := super.NewContext()
	w, err := anyio.NewWriter(sctx, sio.NopCloser(&buf), anyio.WriterOpts{Format: format})
	if err != nil {
		return nil, err
	}
	defer w.Close()
	// Les sources enregistrées n'ont pas forcément d'extension : détection par le contenu.
	env := exec.NewEnvironment(eng, nil)
	env.ReaderOpts.Format = "auto"
	q, err := runtime.CompileQuery(context.Background(), sctx, compiler.NewCompilerWithEnv(env), ast)
	if err != nil {
		return nil, err
	}
	defer q.Pull(true)
	if err := vio.Copy(w, q); err != nil {
		return nil, err
	}
	if err := w.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func jsError(err error) js.Value {
	return js.Global().Get("Error").New(err.Error())
}

func main() {
	api := js.Global().Get("Object").New()
	api.Set("version", version)
	api.Set("register", js.FuncOf(func(_ js.Value, args []js.Value) any {
		b := make([]byte, args[1].Get("length").Int())
		js.CopyBytesToGo(b, args[1])
		// Un panic dans un js.FuncOf arrête le programme Go : on renvoie l'erreur.
		if err := eng.add(args[0].String(), b); err != nil {
			return err.Error()
		}
		return nil
	}))
	api.Set("unregister", js.FuncOf(func(_ js.Value, args []js.Value) any {
		eng.remove(args[0].String())
		return nil
	}))
	api.Set("names", js.FuncOf(func(js.Value, []js.Value) any {
		names := eng.list()
		out := make([]any, len(names))
		for i, n := range names {
			out[i] = n
		}
		return js.ValueOf(out)
	}))
	api.Set("run", js.FuncOf(func(_ js.Value, args []js.Value) any {
		query := args[0].String()
		format := "bsup"
		if len(args) > 1 && args[1].Type() == js.TypeString {
			format = args[1].String()
		}
		return js.Global().Get("Promise").New(js.FuncOf(func(_ js.Value, pa []js.Value) any {
			resolve, reject := pa[0], pa[1]
			go func() {
				out, err := run(query, format)
				if err != nil {
					reject.Invoke(jsError(err))
					return
				}
				arr := js.Global().Get("Uint8Array").New(len(out))
				js.CopyBytesToJS(arr, out)
				resolve.Invoke(arr)
			}()
			return nil
		}))
	}))
	js.Global().Set("__superdb", api)
	if ready := js.Global().Get("__superdbReady"); ready.Type() == js.TypeFunction {
		ready.Invoke()
	}
	select {}
}
