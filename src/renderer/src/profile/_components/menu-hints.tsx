import { Hint } from '../../_components/hint.tsx'
import type { Editor, Row } from '../rows.ts'

type MenuHintsProps = { editor: Editor | null; preview: boolean; pad: boolean; inPane: boolean; row?: Row; confirming: string | null }

/** Hints follow what the buttons do right now: in the sections, on the focused option, in a field or a preview. */
export function MenuHints({ editor, preview, pad, inPane, row, confirming }: MenuHintsProps) {
  if (preview)
    return (
      <span className="sheet-hints">
        <Hint b="A">Adicionar</Hint>
        <Hint b="B">Voltar</Hint>
      </span>
    )
  if (editor)
    return (
      <span className="sheet-hints">
        {pad ? (
          <>
            <Hint b="A">Digitar</Hint>
            {editor.row.keys === 'url' && <Hint b="Y">Maiúsculas</Hint>}
            <Hint b="B">{editor.draft ? 'Apagar' : 'Cancelar'}</Hint>
            <Hint b="Menu">Salvar</Hint>
          </>
        ) : (
          <>
            <Hint b="A">Salvar</Hint>
            <Hint b="B">Cancelar</Hint>
          </>
        )}
      </span>
    )
  return (
    <span className="sheet-hints">
      {!inPane ? (
        <Hint b="A">Abrir</Hint>
      ) : row?.kind === 'choice' ? (
        <Hint b={['Left', 'Right']}>Escolher</Hint>
      ) : row?.kind === 'text' ? (
        <Hint b="A">Editar</Hint>
      ) : (
        row?.tag && <Hint b="A">{confirming === row.id ? 'Confirmar' : row.tag}</Hint>
      )}
      {inPane && row?.kind === 'action' && row.secondary && (
        <Hint b="X">{confirming === `x:${row.id}` ? 'Confirmar' : row.secondary.tag}</Hint>
      )}
      <Hint b={['LB', 'RB']}>Seção</Hint>
      <Hint b="B">{!inPane ? 'Fechar' : confirming ? 'Cancelar' : 'Seções'}</Hint>
    </span>
  )
}
