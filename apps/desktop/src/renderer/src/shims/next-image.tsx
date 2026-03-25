import type { CSSProperties, ImgHTMLAttributes } from 'react'

type ImageSource = string | { src: string }

type NextImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  fill?: boolean
  priority?: boolean
  quality?: number
  sizes?: string
  src: ImageSource
  unoptimized?: boolean
}

function resolveImageSource(source: ImageSource): string {
  return typeof source === 'string' ? source : source.src
}

export default function Image({ fill, src, style, ...props }: NextImageProps) {
  const imageStyle: CSSProperties | undefined = fill
    ? {
        height: '100%',
        inset: 0,
        objectFit: style?.objectFit ?? 'cover',
        position: 'absolute',
        width: '100%',
        ...style,
      }
    : style

  return <img {...props} src={resolveImageSource(src)} style={imageStyle} />
}
