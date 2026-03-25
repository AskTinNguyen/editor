import type { AnchorHTMLAttributes, ReactNode } from 'react'

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode
  href: string | URL
}

export default function Link({ children, href, ...props }: LinkProps) {
  return (
    <a {...props} href={href.toString()}>
      {children}
    </a>
  )
}
