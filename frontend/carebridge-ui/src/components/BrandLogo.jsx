/**
 * CareBridge hospital mark — source: public/carebridge-logo.png
 */
export default function BrandLogo({ className = '', alt = 'CareBridge AI' }) {
  const src = `${process.env.PUBLIC_URL || ''}/carebridge-logo.png`
  return (
    <img
      src={src}
      alt={alt}
      className={`object-contain select-none ${className}`}
      draggable={false}
    />
  )
}
