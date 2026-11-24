// The store's icons, from Lucide (lucide-react). They draw with currentColor, so they follow the
// text colour. Wrapped here so every page asks for "the bag icon" rather than a Lucide name, and
// each keeps the size it was designed at.
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Bell,
  Briefcase,
  CalendarClock,
  Check,
  ChevronRight,
  ClipboardPaste,
  CreditCard,
  Eye,
  EyeOff,
  Gift,
  Handshake,
  House,
  Lock,
  Mail,
  MapPin,
  Menu,
  Minus,
  Newspaper,
  Pencil,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react'

type IconProps = { size?: number; className?: string }

export const SearchIcon = ({ size = 20, className }: IconProps) => <Search size={size} className={className} aria-hidden />
export const BagIcon = ({ size = 22, className }: IconProps) => <ShoppingBag size={size} className={className} aria-hidden />
export const UserIcon = ({ size = 22, className }: IconProps) => <User size={size} className={className} aria-hidden />
export const MenuIcon = ({ size = 24, className }: IconProps) => <Menu size={size} className={className} aria-hidden />
export const CloseIcon = ({ size = 22, className }: IconProps) => <X size={size} className={className} aria-hidden />
export const GiftIcon = ({ size = 22, className }: IconProps) => <Gift size={size} className={className} aria-hidden />
export const PinIcon = ({ size = 22, className }: IconProps) => <MapPin size={size} className={className} aria-hidden />
export const BackIcon = ({ size = 18, className }: IconProps) => <ArrowLeft size={size} className={className} aria-hidden />
export const EyeIcon = ({ size = 20, className }: IconProps) => <Eye size={size} className={className} aria-hidden />
export const EyeOffIcon = ({ size = 20, className }: IconProps) => <EyeOff size={size} className={className} aria-hidden />
export const ArrowIcon = ({ size = 20, className }: IconProps) => <ArrowRight size={size} className={className} aria-hidden />
export const PlusIcon = ({ size = 18, className }: IconProps) => <Plus size={size} className={className} aria-hidden />
export const MinusIcon = ({ size = 18, className }: IconProps) => <Minus size={size} className={className} aria-hidden />
export const TrashIcon = ({ size = 18, className }: IconProps) => <Trash2 size={size} className={className} aria-hidden />
export const CheckIcon = ({ size = 18, className }: IconProps) => <Check size={size} className={className} aria-hidden />
export const ChevronIcon = ({ size = 18, className }: IconProps) => <ChevronRight size={size} className={className} aria-hidden />
export const TruckIcon = ({ size = 26, className }: IconProps) => <Truck size={size} className={className} aria-hidden />
export const CashIcon = ({ size = 26, className }: IconProps) => <Banknote size={size} className={className} aria-hidden />
export const CardIcon = ({ size = 26, className }: IconProps) => <CreditCard size={size} className={className} aria-hidden />
export const LockIcon = ({ size = 18, className }: IconProps) => <Lock size={size} className={className} aria-hidden />
export const HomeIcon = ({ size = 20, className }: IconProps) => <House size={size} className={className} aria-hidden />
export const WorkIcon = ({ size = 20, className }: IconProps) => <Briefcase size={size} className={className} aria-hidden />
export const EditIcon = ({ size = 16, className }: IconProps) => <Pencil size={size} className={className} aria-hidden />
export const MailIcon = ({ size = 26, className }: IconProps) => <Mail size={size} className={className} aria-hidden />
export const PhoneIcon = ({ size = 18, className }: IconProps) => <Phone size={size} className={className} aria-hidden />
export const PasteIcon = ({ size = 16, className }: IconProps) => <ClipboardPaste size={size} className={className} aria-hidden />
export const BellIcon = ({ size = 18, className }: IconProps) => <Bell size={size} className={className} aria-hidden />
export const BlogIcon = ({ size = 20, className }: IconProps) => <Newspaper size={size} className={className} aria-hidden />
// The WhatsApp logo (Lucide has no brand icons).
export const WhatsAppIcon = ({ size = 22, className }: IconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden>
    <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.24 9.43-9.44 9.43m8.03-17.46A11.27 11.27 0 0 0 12.05.72C5.79.72.7 5.8.7 12.06c0 2 .52 3.95 1.52 5.67L.6 23.28l5.68-1.49a11.3 11.3 0 0 0 5.76 1.47h.01c6.25 0 11.34-5.09 11.35-11.34 0-3.03-1.18-5.88-3.32-8.02" />
  </svg>
)

// The store's own bulk-orders drawing (stacked boxes with a tick), drawn in the text colour like the rest.
export const BulkIcon = ({ size = 20, className }: IconProps) => <Truck size={size} className={className} aria-hidden />
export const HandshakeIcon = ({ size = 22, className }: IconProps) => <Handshake size={size} className={className} aria-hidden />
export const CalendarIcon = ({ size = 22, className }: IconProps) => <CalendarClock size={size} className={className} aria-hidden />

// filled: a solid star (part of the rating); otherwise only its outline.
export const StarIcon = ({ size = 18, className, filled = false }: IconProps & { filled?: boolean }) => (
  <Star size={size} strokeWidth={1.6} fill={filled ? 'currentColor' : 'none'} className={className} aria-hidden />
)

// The leaf from the logo's badge; used where a product has no photo. It's the brand's own mark,
// so it stays drawn here rather than coming from Lucide.
export const LeafMark = ({ size = 48, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={className}>
    <path d="M32 10c11 7 14 21 4 33-1 1-2.6 2.6-4 3.6-1.4-1-3-2.6-4-3.6-10-12-7-26 4-33z" fill="currentColor" />
    <path d="M32 20v30" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
  </svg>
)
