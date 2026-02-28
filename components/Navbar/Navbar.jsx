import Link from 'next/link';
import { useRouter } from 'next/router';
import { Disclosure } from '@headlessui/react';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import {
  Bars3Icon,
  CalendarDaysIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  MoonIcon,
  SunIcon,
  HomeIcon,
  XMarkIcon,
  ArrowLeftOnRectangleIcon,
  ArrowRightOnRectangleIcon,
  SwatchIcon,
  UserMinusIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { useThemeMode } from '@/context/ThemeContext';

const Navbar = () => {
  const router = useRouter();
  const { isAuthenticated, signOut, role, actualRole, isImpersonating, stopImpersonation } = useAuth();
  const { themeMode, setThemeMode, themeAccent, setThemeAccent } = useThemeMode();

  const accentThemes = [
    { value: 'aurora', label: 'Aurora Mint' },
    { value: 'sunset', label: 'Sunset Gold' },
    { value: 'ember', label: 'Ember Rose' },
    { value: 'orchid', label: 'Orchid Pop' },
  ];

  const links = [
    { name: 'Home', href: '/', icon: HomeIcon },
    { name: 'Appointments', href: '/Appointments', icon: CalendarDaysIcon },
    { name: 'Dashboard', href: '/Dashboard', icon: ChartBarIcon },
  ];

  if (isAuthenticated && actualRole === 'admin') {
    links.push({ name: 'Admin Operations', href: '/AdminOperations', icon: Cog6ToothIcon });
  }

  const onSignOut = async () => {
    await signOut();
    router.push('/Login');
  };

  return (
    <Disclosure as="nav" className="sticky top-0 z-40 border-b border-[var(--app-nav-border)] bg-[var(--app-nav-bg)] backdrop-blur shadow-lg">
      {({ open }) => (
        <>
          <div className="mx-auto flex h-20 w-full max-w-screen-2xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--app-nav-text)]">
              SmartAppointment
            </Link>

            <div className="hidden min-w-0 items-center gap-3 md:flex md:flex-nowrap">
              {links.map((item) => {
                const active = router.pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex h-[var(--app-control-height)] items-center gap-2 whitespace-nowrap rounded-md px-4 text-base font-medium transition ${
                      active
                        ? 'border border-[var(--app-nav-link-active-border)] bg-[var(--app-nav-link-active-bg)] text-[var(--app-nav-link-active-text)]'
                        : 'text-[var(--app-nav-link-text)] hover:bg-[var(--app-nav-link-hover-bg)] hover:text-[var(--app-nav-link-hover-text)]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
              <div className="ml-1 hidden items-center gap-2 rounded-lg border border-[var(--app-nav-border)] bg-[var(--app-nav-link-hover-bg)] px-2 py-1.5 xl:flex xl:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setThemeMode('night')}
                  className={`inline-flex h-[var(--app-control-height)] items-center gap-1 rounded px-3 text-sm font-medium transition ${
                    themeMode === 'night'
                      ? 'bg-[var(--app-nav-link-active-bg)] text-[var(--app-nav-link-active-text)]'
                      : 'text-[var(--app-nav-link-text)] hover:text-[var(--app-nav-link-hover-text)]'
                  }`}
                >
                  <SunIcon className="h-3.5 w-3.5" />
                  Night
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`inline-flex h-[var(--app-control-height)] items-center gap-1 rounded px-3 text-sm font-medium transition ${
                    themeMode === 'dark'
                      ? 'bg-[var(--app-nav-link-active-bg)] text-[var(--app-nav-link-active-text)]'
                      : 'text-[var(--app-nav-link-text)] hover:text-[var(--app-nav-link-hover-text)]'
                  }`}
                >
                  <MoonIcon className="h-3.5 w-3.5" />
                  Dark
                </button>
                <div className="ml-1 flex items-center gap-2">
                  <label className="app-label mb-0 text-sm">Theme</label>
                  <FormControl
                    sx={{
                      minWidth: 200,
                    }}
                  >
                    <Select
                      value={themeAccent}
                      onChange={(event) => setThemeAccent(event.target.value)}
                      sx={{
                        minHeight: 'var(--app-control-height)',
                        height: 'var(--app-control-height)',
                        borderRadius: '0.5rem',
                        color: 'var(--app-nav-link-text)',
                        backgroundColor: 'var(--app-nav-bg)',
                        '& .MuiSelect-select': {
                          display: 'flex',
                          alignItems: 'center',
                          minHeight: 'var(--app-control-height) !important',
                          py: 0,
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'var(--app-nav-border)',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'var(--app-nav-link-active-border)',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'var(--app-nav-link-active-border)',
                        },
                        '& .MuiSvgIcon-root': {
                          color: 'var(--app-nav-link-text)',
                        },
                      }}
                    >
                      {accentThemes.map((theme) => (
                        <MenuItem key={theme.value} value={theme.value}>
                          {theme.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>
              </div>

              {isAuthenticated ? (
                <div className="ml-1 flex items-center gap-2">
                  <span className="whitespace-nowrap rounded-full border border-[var(--app-pill-border)] bg-[var(--app-pill-bg)] px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--app-pill-text)]">
                    {isImpersonating ? `Viewing ${role}` : role}
                  </span>
                  {isImpersonating && (
                    <button
                      type="button"
                      onClick={stopImpersonation}
                      aria-label="Exit view-as"
                      title="Exit view-as"
                      className="inline-flex h-[var(--app-control-height)] w-[var(--app-control-height)] items-center justify-center rounded-md border border-[var(--app-nav-border)] text-[var(--app-nav-link-text)] transition hover:bg-[var(--app-nav-link-hover-bg)]"
                    >
                      <UserMinusIcon className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onSignOut}
                    aria-label="Sign out"
                    title="Sign out"
                    className="inline-flex h-[var(--app-control-height)] w-[var(--app-control-height)] items-center justify-center rounded-md border border-[var(--app-nav-border)] text-[var(--app-nav-link-text)] transition hover:bg-[var(--app-nav-link-hover-bg)]"
                  >
                    <ArrowRightOnRectangleIcon className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <Link
                  href="/Login"
                  className="inline-flex h-[var(--app-control-height)] items-center gap-2 rounded-md bg-[var(--app-primary-btn-bg)] px-5 text-base font-medium text-[var(--app-primary-btn-text)] transition hover:bg-[var(--app-primary-btn-hover)]"
                >
                  <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                  Sign in
                </Link>
              )}
            </div>

            <Disclosure.Button className="rounded-md p-2 text-[var(--app-nav-link-text)] hover:bg-[var(--app-nav-link-hover-bg)] md:hidden">
              {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </Disclosure.Button>
          </div>

          <Disclosure.Panel className="border-t border-[var(--app-nav-border)] px-4 py-3 md:hidden">
            <div className="flex flex-col gap-2">
              {links.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex h-[var(--app-control-height)] items-center gap-2 rounded-md px-3 text-base font-medium text-[var(--app-nav-link-text)] transition hover:bg-[var(--app-nav-link-hover-bg)]"
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setThemeMode('night')}
                  className={`inline-flex h-[var(--app-control-height)] items-center justify-center gap-1 rounded-md border px-3 text-base font-medium ${
                    themeMode === 'night'
                      ? 'border-[var(--app-nav-link-active-border)] bg-[var(--app-nav-link-active-bg)] text-[var(--app-nav-link-active-text)]'
                      : 'border-[var(--app-nav-border)] text-[var(--app-nav-link-text)]'
                  }`}
                >
                  <SunIcon className="h-4 w-4" />
                  Night
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`inline-flex h-[var(--app-control-height)] items-center justify-center gap-1 rounded-md border px-3 text-base font-medium ${
                    themeMode === 'dark'
                      ? 'border-[var(--app-nav-link-active-border)] bg-[var(--app-nav-link-active-bg)] text-[var(--app-nav-link-active-text)]'
                      : 'border-[var(--app-nav-border)] text-[var(--app-nav-link-text)]'
                  }`}
                >
                  <MoonIcon className="h-4 w-4" />
                  Dark
                </button>
              </div>

              <div>
                <label className="app-label">Theme</label>
                <FormControl fullWidth size="small">
                  <Select
                    value={themeAccent}
                    onChange={(event) => setThemeAccent(event.target.value)}
                    startAdornment={<SwatchIcon className="ml-2 mr-1 h-4 w-4 text-[var(--app-nav-link-text)]" />}
                    sx={{
                      minHeight: 'var(--app-control-height)',
                      height: 'var(--app-control-height)',
                      borderRadius: '0.5rem',
                      color: 'var(--app-nav-link-text)',
                      '& .MuiSelect-select': {
                        display: 'flex',
                        alignItems: 'center',
                        minHeight: 'var(--app-control-height) !important',
                        py: 0,
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'var(--app-nav-border)',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'var(--app-nav-link-active-border)',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'var(--app-nav-link-active-border)',
                      },
                      '& .MuiSvgIcon-root': {
                        color: 'var(--app-nav-link-text)',
                      },
                    }}
                  >
                    {accentThemes.map((theme) => (
                      <MenuItem key={theme.value} value={theme.value}>
                        {theme.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>

              {isAuthenticated ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-[var(--app-pill-border)] bg-[var(--app-pill-bg)] px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--app-pill-text)]">
                    {isImpersonating ? `Viewing ${role}` : role}
                  </span>
                  <div className="flex items-center gap-2">
                    {isImpersonating && (
                      <button
                        type="button"
                        onClick={stopImpersonation}
                        aria-label="Exit view-as"
                        title="Exit view-as"
                        className="inline-flex h-[var(--app-control-height)] w-[var(--app-control-height)] items-center justify-center rounded-md border border-[var(--app-nav-border)] text-[var(--app-nav-link-text)]"
                      >
                        <UserMinusIcon className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onSignOut}
                      aria-label="Sign out"
                      title="Sign out"
                      className="inline-flex h-[var(--app-control-height)] w-[var(--app-control-height)] items-center justify-center rounded-md border border-[var(--app-nav-border)] text-[var(--app-nav-link-text)]"
                    >
                      <ArrowRightOnRectangleIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <Link
                  href="/Login"
                  className="inline-flex h-[var(--app-control-height)] items-center gap-2 rounded-md bg-[var(--app-primary-btn-bg)] px-3 text-base font-medium text-[var(--app-primary-btn-text)]"
                >
                  <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                  Sign in
                </Link>
              )}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  )
}

export default Navbar