"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { AlertCircle, CheckCircle2, CircleX, Info, LoaderCircle } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CheckCircle2 aria-hidden="true" className="size-4" />
        ),
        info: (
          <Info aria-hidden="true" className="size-4" />
        ),
        warning: (
          <AlertCircle aria-hidden="true" className="size-4" />
        ),
        error: (
          <CircleX aria-hidden="true" className="size-4" />
        ),
        loading: (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
