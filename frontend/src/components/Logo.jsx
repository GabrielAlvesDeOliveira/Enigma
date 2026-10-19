import logoUrl from '../assets/logo.svg'

export default function Logo({ className = '' }) {
  return <img className={`logo ${className}`.trim()} src={logoUrl} alt="" aria-hidden="true" />
}
