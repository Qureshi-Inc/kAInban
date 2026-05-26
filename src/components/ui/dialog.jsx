import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import * as React from 'react'
import { cn } from '../../lib/utils'

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

// v3 dialog overlay — solid scrim, no blur (per DESIGN.md → Motion).
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/55 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef(
  ({ className, children, ...props }, ref) => {
    const [isKeyboardVisible, setIsKeyboardVisible] = React.useState(false)
    const contentRef = React.useRef(null)

    React.useEffect(() => {
      const handleFocus = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
          setIsKeyboardVisible(true)
          // Scroll the focused input into view after a short delay
          setTimeout(() => {
            e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 300)
        }
      }

      const handleBlur = () => {
        setIsKeyboardVisible(false)
      }

      const handleResize = () => {
        // Detect keyboard hiding by viewport resize
        if (window.visualViewport) {
          const viewportHeight = window.visualViewport.height
          const windowHeight = window.innerHeight
          setIsKeyboardVisible(viewportHeight < windowHeight * 0.75)
        }
      }

      document.addEventListener('focusin', handleFocus)
      document.addEventListener('focusout', handleBlur)
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleResize)
      }

      return () => {
        document.removeEventListener('focusin', handleFocus)
        document.removeEventListener('focusout', handleBlur)
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleResize)
        }
      }
    }, [])

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={contentRef}
          className={cn(
            'fixed left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 gap-4 border border-border bg-card text-card-foreground p-5 sm:p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-md sm:w-full',
            isKeyboardVisible
              ? 'top-4 translate-y-0 max-h-[calc(100vh-8rem)] overflow-y-auto'
              : 'top-1/2 -translate-y-1/2 max-sm:my-8 max-sm:max-h-[calc(100vh-4rem)] max-sm:overflow-y-auto',
            className
          )}
          {...props}
        >
          {children}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    )
  }
)
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center',
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg leading-tight tracking-tight font-emphasis text-foreground',
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
}
