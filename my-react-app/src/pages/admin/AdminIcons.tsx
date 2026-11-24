// Icons for the admin menu and tables, from Lucide (lucide-react), drawn with currentColor.
// A slightly lighter stroke than the storefront's icons, to suit the denser admin screens.
import {
  ArrowDown,
  ArrowUp,
  Bold,
  CheckCheck,
  ChevronDown,
  ChevronsLeft,
  CircleAlert,
  CodeXml,
  Columns3,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Gift,
  Heading2,
  Heading3,
  Image,
  ImagePlus,
  Inbox,
  Italic,
  KeyRound,
  LayoutDashboard,
  Link,
  List,
  ListOrdered,
  LoaderCircle,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessageSquareText,
  Minus,
  Newspaper,
  Package,
  PackagePlus,
  Phone,
  Pencil,
  Pilcrow,
  Plus,
  Quote,
  Receipt,
  Redo2,
  RemoveFormatting,
  Rows3,
  Settings,
  ShieldCheck,
  SquarePlay,
  Store,
  Strikethrough,
  Table,
  Tag,
  Ticket,
  Trash2,
  Truck,
  Underline,
  Undo2,
  Unlink,
  Upload,
  UserCog,
  UserRound,
  Users,
  X,
} from 'lucide-react'

type P = { size?: number; className?: string }

export const DashboardIcon = ({ size = 20, className }: P) => <LayoutDashboard size={size} strokeWidth={1.9} className={className} aria-hidden />
export const CustomersIcon = ({ size = 20, className }: P) => <Users size={size} strokeWidth={1.9} className={className} aria-hidden />
export const FreeShippingIcon = ({ size = 20, className }: P) => <Truck size={size} strokeWidth={1.9} className={className} aria-hidden />
export const OffersIcon = ({ size = 20, className }: P) => <Gift size={size} strokeWidth={1.9} className={className} aria-hidden />
export const ProfileIcon = ({ size = 20, className }: P) => <UserRound size={size} strokeWidth={1.9} className={className} aria-hidden />
export const ManagersIcon = ({ size = 20, className }: P) => <UserCog size={size} strokeWidth={1.9} className={className} aria-hidden />
export const LockKeyIcon = ({ size = 20, className }: P) => <KeyRound size={size} strokeWidth={1.9} className={className} aria-hidden />
export const OrdersIcon = ({ size = 20, className }: P) => <Receipt size={size} strokeWidth={1.9} className={className} aria-hidden />
export const BoxIcon = ({ size = 20, className }: P) => <Package size={size} strokeWidth={1.9} className={className} aria-hidden />
export const AddBoxIcon = ({ size = 20, className }: P) => <PackagePlus size={size} strokeWidth={1.9} className={className} aria-hidden />
export const TagIcon = ({ size = 20, className }: P) => <Tag size={size} strokeWidth={1.9} className={className} aria-hidden />
export const TicketIcon = ({ size = 20, className }: P) => <Ticket size={size} strokeWidth={1.9} className={className} aria-hidden />
export const SettingsIcon = ({ size = 20, className }: P) => <Settings size={size} strokeWidth={1.9} className={className} aria-hidden />
export const StoreIcon = ({ size = 20, className }: P) => <Store size={size} strokeWidth={1.9} className={className} aria-hidden />
export const LogoutIcon = ({ size = 20, className }: P) => <LogOut size={size} strokeWidth={1.9} className={className} aria-hidden />
export const MenuIcon = ({ size = 22, className }: P) => <Menu size={size} strokeWidth={1.9} className={className} aria-hidden />
export const CloseIcon = ({ size = 22, className }: P) => <X size={size} strokeWidth={1.9} className={className} aria-hidden />
export const ChevronDownIcon = ({ size = 18, className }: P) => <ChevronDown size={size} strokeWidth={1.9} className={className} aria-hidden />
export const CollapseIcon = ({ size = 18, className }: P) => <ChevronsLeft size={size} strokeWidth={1.9} className={className} aria-hidden />
export const EditIcon = ({ size = 18, className }: P) => <Pencil size={size} strokeWidth={1.9} className={className} aria-hidden />
export const DeleteIcon = ({ size = 18, className }: P) => <Trash2 size={size} strokeWidth={1.9} className={className} aria-hidden />
export const ImageIcon = ({ size = 20, className }: P) => <Image size={size} strokeWidth={1.9} className={className} aria-hidden />
export const AnnouncementIcon = ({ size = 20, className }: P) => <Megaphone size={size} strokeWidth={1.9} className={className} aria-hidden />
export const ArrowUpIcon = ({ size = 18, className }: P) => <ArrowUp size={size} strokeWidth={1.9} className={className} aria-hidden />
export const ArrowDownIcon = ({ size = 18, className }: P) => <ArrowDown size={size} strokeWidth={1.9} className={className} aria-hidden />
export const PlusIcon = ({ size = 18, className }: P) => <Plus size={size} strokeWidth={1.9} className={className} aria-hidden />
export const SpinnerIcon = ({ size = 18, className }: P) => <LoaderCircle size={size} strokeWidth={2} className={className} aria-hidden />
export const DownloadIcon = ({ size = 18, className }: P) => <Download size={size} strokeWidth={1.9} className={className} aria-hidden />
export const UploadIcon = ({ size = 22, className }: P) => <Upload size={size} strokeWidth={1.9} className={className} aria-hidden />
export const AlertIcon = ({ size = 20, className }: P) => <CircleAlert size={size} strokeWidth={1.9} className={className} aria-hidden />
export const EyeIcon = ({ size = 18, className }: P) => <Eye size={size} strokeWidth={1.9} className={className} aria-hidden />
export const EyeOffIcon = ({ size = 18, className }: P) => <EyeOff size={size} strokeWidth={1.9} className={className} aria-hidden />
export const ShieldIcon = ({ size = 20, className }: P) => <ShieldCheck size={size} strokeWidth={1.9} className={className} aria-hidden />
export const EnquiriesIcon = ({ size = 20, className }: P) => <Inbox size={size} strokeWidth={1.9} className={className} aria-hidden />
export const MailIcon = ({ size = 18, className }: P) => <Mail size={size} strokeWidth={1.9} className={className} aria-hidden />
export const PhoneIcon = ({ size = 18, className }: P) => <Phone size={size} strokeWidth={1.9} className={className} aria-hidden />
export const ReadIcon = ({ size = 18, className }: P) => <CheckCheck size={size} strokeWidth={1.9} className={className} aria-hidden />
export const ReviewsIcon = ({ size = 20, className }: P) => <MessageSquareText size={size} strokeWidth={1.9} className={className} aria-hidden />
export const BlogIcon = ({ size = 20, className }: P) => <Newspaper size={size} strokeWidth={1.9} className={className} aria-hidden />
export const ExternalLinkIcon = ({ size = 18, className }: P) => <ExternalLink size={size} strokeWidth={1.9} className={className} aria-hidden />

// The blog editor's toolbar.
export const ParagraphIcon = ({ size = 18, className }: P) => <Pilcrow size={size} strokeWidth={1.9} className={className} aria-hidden />
export const Heading2Icon = ({ size = 18, className }: P) => <Heading2 size={size} strokeWidth={1.9} className={className} aria-hidden />
export const Heading3Icon = ({ size = 18, className }: P) => <Heading3 size={size} strokeWidth={1.9} className={className} aria-hidden />
export const BoldIcon = ({ size = 18, className }: P) => <Bold size={size} strokeWidth={2.2} className={className} aria-hidden />
export const ItalicIcon = ({ size = 18, className }: P) => <Italic size={size} strokeWidth={1.9} className={className} aria-hidden />
export const UnderlineIcon = ({ size = 18, className }: P) => <Underline size={size} strokeWidth={1.9} className={className} aria-hidden />
export const StrikeIcon = ({ size = 18, className }: P) => <Strikethrough size={size} strokeWidth={1.9} className={className} aria-hidden />
export const BulletListIcon = ({ size = 18, className }: P) => <List size={size} strokeWidth={1.9} className={className} aria-hidden />
export const NumberListIcon = ({ size = 18, className }: P) => <ListOrdered size={size} strokeWidth={1.9} className={className} aria-hidden />
export const QuoteIcon = ({ size = 18, className }: P) => <Quote size={size} strokeWidth={1.9} className={className} aria-hidden />
export const LinkIcon = ({ size = 18, className }: P) => <Link size={size} strokeWidth={1.9} className={className} aria-hidden />
export const UnlinkIcon = ({ size = 18, className }: P) => <Unlink size={size} strokeWidth={1.9} className={className} aria-hidden />
export const ImagePlusIcon = ({ size = 18, className }: P) => <ImagePlus size={size} strokeWidth={1.9} className={className} aria-hidden />
export const TableIcon = ({ size = 18, className }: P) => <Table size={size} strokeWidth={1.9} className={className} aria-hidden />
export const AddRowIcon = ({ size = 18, className }: P) => <Rows3 size={size} strokeWidth={1.9} className={className} aria-hidden />
export const AddColumnIcon = ({ size = 18, className }: P) => <Columns3 size={size} strokeWidth={1.9} className={className} aria-hidden />
export const VideoIcon = ({ size = 18, className }: P) => <SquarePlay size={size} strokeWidth={1.9} className={className} aria-hidden />
export const RuleIcon = ({ size = 18, className }: P) => <Minus size={size} strokeWidth={1.9} className={className} aria-hidden />
export const ClearFormatIcon = ({ size = 18, className }: P) => <RemoveFormatting size={size} strokeWidth={1.9} className={className} aria-hidden />
export const UndoIcon = ({ size = 18, className }: P) => <Undo2 size={size} strokeWidth={1.9} className={className} aria-hidden />
export const RedoIcon = ({ size = 18, className }: P) => <Redo2 size={size} strokeWidth={1.9} className={className} aria-hidden />
export const CodeIcon = ({ size = 18, className }: P) => <CodeXml size={size} strokeWidth={1.9} className={className} aria-hidden />
