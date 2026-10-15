// Mensagem de erro de um formulário. Não aparece nada se não houver mensagem.
export default function FormError({ message }) {
  if (!message) return null

  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  )
}
