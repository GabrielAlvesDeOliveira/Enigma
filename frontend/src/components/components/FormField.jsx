import { useId } from 'react'

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
