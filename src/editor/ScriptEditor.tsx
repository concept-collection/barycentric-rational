import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { indentUnit, StreamLanguage } from '@codemirror/language'
import { octave } from '@codemirror/legacy-modes/mode/octave'
import { oneDark } from '@codemirror/theme-one-dark'

export interface ScriptEditorProps {
  value: string
  onChange: (value: string) => void
  /** Ctrl/Cmd+Enter */
  onRun: () => void
}

export default function ScriptEditor({ value, onChange, onRun }: ScriptEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onRunRef = useRef(onRun)
  onRunRef.current = onRun

  useEffect(() => {
    if (!hostRef.current) return
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                onRunRef.current()
                return true
              },
            },
          ]),
          StreamLanguage.define(octave),
          oneDark,
          indentUnit.of('    '),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // created once; external value changes are synced below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // sync an externally loaded script (a different method picked) into the editor
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  return <div className="editor-host" ref={hostRef} />
}
