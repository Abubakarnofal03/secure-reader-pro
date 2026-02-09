import { ReactNode } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Phone, Mail, HelpCircle } from "lucide-react"

interface ContactSupportProps {
    children?: ReactNode;
}

export function ContactSupport({ children }: ContactSupportProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                {children || (
                    <button type="button" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-6 group">
                        <HelpCircle className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                        <span className="underline decoration-dotted underline-offset-2 hover:decoration-solid">Contact Support</span>
                    </button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex flex-col items-center gap-2 mb-2">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <HelpCircle className="h-5 w-5 text-primary" />
                        </div>
                        <DialogTitle>Contact Support</DialogTitle>
                        <DialogDescription className="text-center">
                            Have questions? We're here to help.
                        </DialogDescription>
                    </div>
                </DialogHeader>
                <div className="flex flex-col gap-3 py-2">
                    <a
                        href="tel:+923047954411"
                        className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/20 transition-all group"
                    >
                        <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                            <Phone className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium leading-none mb-1.5">Phone Support</p>
                            <p className="text-sm text-muted-foreground font-mono group-hover:text-foreground transition-colors">+92 304 7954411</p>
                        </div>
                    </a>

                    <a
                        href="mailto:mycalorics@gmail.com"
                        className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/20 transition-all group"
                    >
                        <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                            <Mail className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium leading-none mb-1.5">Email Support</p>
                            <p className="text-sm text-muted-foreground font-mono group-hover:text-foreground transition-colors">mycalorics@gmail.com</p>
                        </div>
                    </a>
                </div>
            </DialogContent>
        </Dialog>
    )
}
