import {
  LayoutDashboard, Boxes, Layers, Truck, PackageCheck, Users, ShieldCheck, ScrollText, Settings, ClipboardCheck,
  SlidersHorizontal, TriangleAlert, ArrowLeftRight, TrendingDown, CalendarClock, FileText, Building2, ChartColumn,
  Activity, RefreshCcw, History, ListChecks, CirclePlus, Receipt, PackageSearch, Search, Bell, Menu, Sun, Moon,
  LogOut, CircleUser, Eye, EyeOff, X, ChevronDown, ChevronRight, Package, UserCheck, UserX, Hourglass, Clock3,
  CircleAlert, PanelLeft, Inbox, ShoppingCart, Warehouse, UserPlus, Lock, Globe, Database, Server, BadgeCheck, PackageOpen, ArrowDownToLine, ArrowUpFromLine, ChartPie,
  CircleCheck, Info, Ban, KeyRound, Save, RotateCcw, Calendar, Hash, Mail, Percent, Phone, MapPin, User, Plus, Trash2,
} from 'lucide-react';

const MAP = {
  dashboard: LayoutDashboard, boxes: Boxes, layers: Layers, truck: Truck, send: PackageCheck, users: Users, shield: ShieldCheck,
  scroll: ScrollText, settings: Settings, count: ClipboardCheck, sliders: SlidersHorizontal, alert: TriangleAlert, moves: ArrowLeftRight,
  lowstock: TrendingDown, expiry: CalendarClock, po: FileText, supplier: Building2, report: ChartColumn, levels: Activity, reorder: RefreshCcw,
  history: History, pick: ListChecks, neworder: CirclePlus, orders: Receipt, availability: PackageSearch, search: Search, bell: Bell, menu: Menu,
  sun: Sun, moon: Moon, logout: LogOut, account: CircleUser, eye: Eye, eyeoff: EyeOff, close: X, down: ChevronDown, right: ChevronRight,
  product: Package, active: UserCheck, disabled: UserX, pending: Hourglass, clock: Clock3, critical: CircleAlert, panel: PanelLeft, inbox: Inbox,
  cart: ShoppingCart, warehouse: Warehouse, adduser: UserPlus, lock: Lock, globe: Globe, db: Database, server: Server, ok: BadgeCheck, open: PackageOpen,
  inbound: ArrowDownToLine, outbound: ArrowUpFromLine, pie: ChartPie,
  check: CircleCheck, info: Info, ban: Ban, key: KeyRound, save: Save, undo: RotateCcw, calendar: Calendar, hash: Hash, mail: Mail, percent: Percent, phone: Phone, pin: MapPin, user: User, plus: Plus, trash: Trash2,
};

export default function Icon({ name, size = 18, className = '', ...rest }) {
  const C = MAP[name];
  if (!C) return null;
  return <C size={size} strokeWidth={1.9} className={`icon ${className}`} aria-hidden="true" {...rest} />;
}
