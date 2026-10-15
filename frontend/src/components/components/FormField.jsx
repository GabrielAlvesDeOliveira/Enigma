import { useId } from 'react'

// Campo de formulário: rótulo + campo + dica opcional.
// "onChange" recebe o texto digitado (não o evento), então nas páginas basta
// usar onChange={setEmail}. Qualquer outro atributo do <input> (required,
// minLength, autoComplete...) é repassado.
export default function FormField({ label, name, type = 'text', value, onChange, hint, ...inputProps }) {
  const id = useId()
  const hintId = `${id}-hint`

  return (
    <div className="form-field">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="form-input"
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={hint ? hintId : undefined}
        {...inputProps}
      />
      {hint && (
        <small id={hintId} className="form-hint">
          {hint}
        </small>
      )}
    </div>
  )
}
