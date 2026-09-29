import type { JSX } from 'preact';
import { useId, useRef, useState } from 'preact/hooks';
import { ApiError } from '@/api/errors';
import type { Schemas } from '@/api/endpoints';
import { formatCount } from '@/lib/format';
import { Button, Field } from '@/ui';
import { useCreateVersion } from './useConfig';

export interface VersionEditorProps {
  modelId: string;
  /** The latest version, which the new one starts from (undefined for a model's first). */
  latest: Schemas['ConfigVersion'] | undefined;
  onSaved: (version: Schemas['ConfigVersion']) => void;
  onCancel: () => void;
}

interface Problem {
  message: string;
  line?: number;
}

function problemFrom(error: unknown): Problem {
  if (!(error instanceof ApiError)) return { message: 'Saving failed. Try again.' };
  const details = error.details;
  const line =
    typeof details === 'object' &&
    details !== null &&
    'line' in details &&
    typeof details.line === 'number'
      ? details.line
      : undefined;
  if (error.status === 409) return { message: 'This text is identical to the latest version.' };
  return { message: error.message, line };
}

export function VersionEditor({ modelId, latest, onSaved, onCancel }: VersionEditorProps) {
  const base = latest?.text ?? '';
  const [note, setNote] = useState('');
  const [text, setText] = useState(base);
  const [problem, setProblem] = useState<Problem | null>(null);
  const escaped = useRef(false);
  const gutter = useRef<HTMLOListElement>(null);
  const create = useCreateVersion(modelId);
  const ids = { text: useId(), hint: useId(), error: useId(), count: useId() };
  const lines = text.split('\n').length;

  // Tab inserts a tab; after Esc, Tab leaves the editor as usual (no keyboard trap).
  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      escaped.current = true;
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey && !escaped.current) {
      event.preventDefault();
      const area = event.currentTarget;
      const { selectionStart: start, selectionEnd: end } = area;
      setText(`${text.slice(0, start)}\t${text.slice(end)}`);
      requestAnimationFrame(() => area.setSelectionRange(start + 1, start + 1));
    }
    escaped.current = false;
  };

  const save = (event: JSX.TargetedSubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The two cheap checks the server also makes; everything else is the server's call.
    if (!note.trim()) return setProblem({ message: 'Add a note describing the change.' });
    if (text === base) {
      return setProblem({
        message: latest ? `Nothing changed from v${latest.version}.` : 'Write the config first.',
      });
    }
    setProblem(null);
    create.mutate(
      { text, note: note.trim() },
      { onSuccess: onSaved, onError: (error) => setProblem(problemFrom(error)) },
    );
  };

  return (
    <form class="editor" onSubmit={save} aria-label="New config version" noValidate>
      <h2>New version{latest ? `, from v${latest.version}` : ''}</h2>
      <Field label="Note" value={note} onInput={(e) => setNote(e.currentTarget.value)} />
      {problem && (
        <p id={ids.error} class="editor__error" role="alert">
          {problem.line ? `Line ${problem.line}: ` : ''}
          {problem.message}
        </p>
      )}
      <label htmlFor={ids.text} class="editor__label">
        Config (uci export)
      </label>
      <div class="editor__body">
        <ol ref={gutter} class="editor__gutter" aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => (
            <li key={i} class={problem?.line === i + 1 ? 'editor__gutter--error' : undefined}>
              {i + 1}
            </li>
          ))}
        </ol>
        <textarea
          id={ids.text}
          value={text}
          spellcheck={false}
          wrap="off"
          aria-invalid={problem?.line ? 'true' : undefined}
          aria-describedby={[problem && ids.error, ids.hint, ids.count].filter(Boolean).join(' ')}
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          onScroll={(e) => {
            if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
          }}
        />
      </div>
      <p class="editor__meta muted">
        <span id={ids.hint}>Tab inserts a tab. To leave the editor, press Esc, then Tab.</span>
        <span id={ids.count}>{formatCount(text.length)} characters</span>
      </p>
      <div class="editor__actions">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" loading={create.isPending}>
          Save version
        </Button>
      </div>
    </form>
  );
}
