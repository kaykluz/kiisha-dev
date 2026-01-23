import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border/40 group-[.toaster]:shadow-lg group-[.toaster]:rounded-2xl group-[.toaster]:px-4 group-[.toaster]:py-3",
          title: "group-[.toast]:text-sm group-[.toast]:font-medium",
          description: "group-[.toast]:text-sm group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-xl group-[.toast]:text-sm group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-xl group-[.toast]:text-sm",
          closeButton:
            "group-[.toast]:bg-transparent group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground group-[.toast]:border-0",
          success:
            "group-[.toaster]:border-l-[3px] group-[.toaster]:border-l-success",
          error:
            "group-[.toaster]:border-l-[3px] group-[.toaster]:border-l-destructive",
          warning:
            "group-[.toaster]:border-l-[3px] group-[.toaster]:border-l-warning",
          info:
            "group-[.toaster]:border-l-[3px] group-[.toaster]:border-l-info",
        },
      }}
      style={
        {
          "--normal-bg": "var(--color-card)",
          "--normal-text": "var(--color-foreground)",
          "--normal-border": "var(--color-border)",
          "--success-bg": "var(--color-card)",
          "--success-text": "var(--color-foreground)",
          "--success-border": "var(--color-success)",
          "--error-bg": "var(--color-card)",
          "--error-text": "var(--color-foreground)",
          "--error-border": "var(--color-destructive)",
          "--warning-bg": "var(--color-card)",
          "--warning-text": "var(--color-foreground)",
          "--warning-border": "var(--color-warning)",
        } as React.CSSProperties
      }
      position="bottom-right"
      expand={false}
      richColors={false}
      closeButton
      {...props}
    />
  );
};

export { Toaster };
