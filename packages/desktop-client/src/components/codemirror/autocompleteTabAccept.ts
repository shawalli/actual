import { acceptCompletion, completionStatus } from '@codemirror/autocomplete';
import { Prec } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';

const getCompletionStatus = completionStatus as unknown as (
  state: EditorView['state'],
) => null | 'active' | 'pending';
const acceptCompletionForView = acceptCompletion as unknown as (
  view: EditorView,
) => boolean;

export const autocompleteTabAccept: Extension = keymap.of([
  {
    key: 'Tab',
    run: view => {
      if (getCompletionStatus(view.state) === 'active') {
        return acceptCompletionForView(view);
      }
      return false;
    },
  },
]);

/**
 * Give this keymap highest priority so it wins over `basicSetup` bindings like
 * `indentWithTab`.
 */
export const autocompleteTabAcceptHighest: Extension = Prec.highest(
  autocompleteTabAccept,
);
