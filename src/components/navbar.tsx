'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2,
  Search,
  LogOut,
  Menu,
  ChevronRight,
  ChevronDown,
  Shield,
  Hash,
  CheckCircle,
  User,
} from 'lucide-react'

import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  CopyButton,
  CommandCenter,
  useCommandCenter,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { useAuth, useSearch } from '@/contexts'
import { APP_ACRONYM, NAV_ITEMS } from '@/constants'

export default function Navbar() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMac, setIsMac] = useState(false)
  const { userInfo, logout } = useAuth()
  const { searchQuery, isSearching, isSearchMode, executeSearchFromParsed } =
    useSearch()

  // Command center state
  const { open: commandCenterOpen, setOpen: setCommandCenterOpen } =
    useCommandCenter()

  // Detect Mac for keyboard shortcut display
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0)
  }, [])

  return (
    <>
      <header className="border-b bg-white top-0 z-10">
        <div className="container mx-auto py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/objects">
                <div className="flex items-center gap-2">
                  <Building2 className="h-6 w-6 text-primary" />
                  <span className="font-bold text-xl">{APP_ACRONYM}</span>
                </div>
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-6">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.name}
                    href={item.path}
                    className={cn(
                      'text-sm font-medium transition-colors',
                      'hover:cursor-pointer hover:text-primary',
                      pathname === item.path || pathname.startsWith(item.path)
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-4">
              {/* Command Center Search Button */}
              <button
                onClick={() => setCommandCenterOpen(true)}
                className={cn(
                  'hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all',
                  'bg-muted/50 hover:bg-muted border-border/50 hover:border-border',
                  'text-muted-foreground hover:text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20',
                  'min-w-[200px] lg:min-w-[280px] max-w-[320px]'
                )}
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left text-sm truncate">
                  {isSearchMode && searchQuery ? searchQuery : 'Search...'}
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono shadow-sm">
                    {isMac ? '⌘' : 'Ctrl'}
                  </kbd>
                  <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono shadow-sm">
                    K
                  </kbd>
                </div>
                {isSearching && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0"></div>
                )}
              </button>

              {/* Mobile Search Button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setCommandCenterOpen(true)}
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </Button>

              {/* User Profile Dropdown - Hidden on Mobile */}
              <div className="hidden md:flex">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 px-3 h-auto hover:bg-muted/50 transition-colors"
                    >
                      <User className="h-4 w-4 text-primary" />
                      <div className="flex flex-col items-start text-left">
                        <span className="text-sm font-medium max-w-32 truncate leading-tight">
                          {userInfo?.certificateInfo.subjectFields.CN || 'User'}
                        </span>
                      </div>
                      <ChevronDown className="h-3 w-3 text-muted-foreground ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex items-center space-x-3 py-2">
                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-semibold leading-none">
                            {userInfo?.certificateInfo.subjectFields.CN ||
                              'User'}
                          </p>
                          <div className="flex items-center gap-1">
                            <Shield className="h-3 w-3 text-green-600" />
                            <p className="text-xs leading-none text-muted-foreground">
                              Certificate Authenticated
                            </p>
                          </div>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {/* User UUID */}
                    {userInfo?.userUUID && (
                      <DropdownMenuItem
                        className="flex flex-col items-start p-3 hover:bg-muted/50"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <Hash className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">
                              User UUID
                            </span>
                          </div>
                          <CopyButton
                            text={userInfo.userUUID}
                            className="h-6 w-6 p-0"
                          />
                        </div>
                        <code className="text-xs bg-muted/30 py-1 rounded w-full block truncate font-mono">
                          {userInfo.userUUID}
                        </code>
                      </DropdownMenuItem>
                    )}

                    {/* Certificate Authentication Status */}
                    {userInfo && (
                      <DropdownMenuItem
                        className="flex flex-col items-start p-3 hover:bg-muted/50"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="h-3 w-3 text-green-600" />
                          <span className="text-xs font-medium text-muted-foreground">
                            Certificate Authentication
                          </span>
                          <div className="ml-auto">
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                              <CheckCircle className="h-3 w-3" />
                              <span className="text-xs font-medium">
                                ACTIVE
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1 w-full">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Authentication:
                            </span>
                            <span className="font-medium text-foreground">
                              Client Certificate
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Session:
                            </span>
                            <span className="font-medium text-foreground">
                              Active
                            </span>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={logout}
                      className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer hover:bg-red-50/50 transition-colors"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      <span className="font-medium">Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Mobile Menu Trigger */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    aria-label="Menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-[80vw] sm:w-[350px] p-0 flex flex-col"
                >
                  <SheetHeader className="border-b p-4">
                    <SheetTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <span>{APP_ACRONYM}</span>
                      </div>
                    </SheetTitle>
                  </SheetHeader>

                  {/* Navigation Items - Top Section */}
                  <div className="flex-1 py-4">
                    <nav className="flex flex-col">
                      {NAV_ITEMS.map((item) => (
                        <SheetClose asChild key={item.path}>
                          <Link
                            href={item.path}
                            className={cn(
                              'flex items-center justify-between py-3 px-4 hover:bg-muted transition-colors',
                              pathname === item.path ||
                                pathname.startsWith(item.path)
                                ? 'bg-muted text-primary font-medium'
                                : 'text-foreground'
                            )}
                          >
                            <span>{item.name}</span>
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </SheetClose>
                      ))}
                    </nav>
                  </div>

                  {/* User Info & Actions - Bottom Section */}
                  <div className="border-t bg-muted/20 p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {userInfo?.certificateInfo.subjectFields.CN || 'User'}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Shield className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-muted-foreground">
                          Certificate Authenticated
                        </span>
                      </div>
                    </div>

                    {/* UUID with Copy Button */}
                    {userInfo?.userUUID && (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            UUID
                          </span>
                          <CopyButton
                            text={userInfo.userUUID}
                            className="h-5 w-5 p-0"
                          />
                        </div>
                        <code className="text-xs block break-all font-mono">
                          {userInfo.userUUID}
                        </code>
                      </>
                    )}

                    {/* Action Buttons */}
                    <div>
                      <Button
                        variant="destructive"
                        className="w-full mt-6"
                        onClick={() => {
                          setIsMobileMenuOpen(false)
                          logout()
                        }}
                      >
                        <span className="mr-auto">Sign out</span>
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Command Center Modal */}
      <CommandCenter
        open={commandCenterOpen}
        onOpenChange={setCommandCenterOpen}
        onSearch={executeSearchFromParsed}
        initialQuery={isSearchMode ? searchQuery : ''}
      />
    </>
  )
}
