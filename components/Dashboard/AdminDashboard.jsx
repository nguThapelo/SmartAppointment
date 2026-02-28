import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import Chip from '@mui/material/Chip';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { apiInstance } from '@/library/apiClient';
import { useMasterData } from '@/hooks/useMasterData';
import { useFeedback } from '@/hooks/useFeedback';
import { useAuth } from '@/hooks/useAuth';
import AppSelectField from '@/components/General/AppSelectField';
import {
  ChartBarIcon,
  Cog6ToothIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  CircleStackIcon,
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const randFormatter = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatRands = (amount) => randFormatter.format(amount);

const normalizeSubCategory = (value) => String(value || '').trim();

const withSubCategory = (list, value) => {
  const nextValue = normalizeSubCategory(value);
  if (!nextValue) {
    return list;
  }

  const exists = list.some((item) => item.toLowerCase() === nextValue.toLowerCase());
  if (exists) {
    return list;
  }

  return [...list, nextValue];
};

const sectionTabs = [
  { key: 'Dashboard', label: 'Dashboard', icon: ChartBarIcon },
  { key: 'Admin Operations', label: 'Admin Operations', icon: Cog6ToothIcon },
];

const operationTabItems = [
  { key: 'Users', label: 'Users', icon: UsersIcon },
  { key: 'Services', label: 'Services', icon: WrenchScrewdriverIcon },
  { key: 'Master Data', label: 'Master Data', icon: CircleStackIcon },
  { key: 'Feedback', label: 'Feedback', icon: ChatBubbleLeftRightIcon },
];

const mapPaymentBadge = (status) => {
  const normalized = String(status || '').toLowerCase();

  if (['succeeded', 'paid', 'captured'].includes(normalized)) {
    return {
      label: 'Paid',
      className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
  }

  if (['failed', 'cancelled', 'canceled', 'requires_payment_method'].includes(normalized)) {
    return {
      label: 'Overdue',
      className: 'bg-rose-100 text-rose-700 border-rose-200',
    };
  }

  return {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  };
};

const AdminDashboard = ({ mode = 'all' }) => {
  const router = useRouter();
  const initialSection = mode === 'operations' ? 'Admin Operations' : 'Dashboard';
  const [activeSection, setActiveSection] = useState(initialSection);
  const [activeTab, setActiveTab] = useState('Users');
  const [userMutationError, setUserMutationError] = useState('');
  const [serviceMutationError, setServiceMutationError] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('client');
  const [categoryName, setCategoryName] = useState('');
  const [subServicesList, setSubServicesList] = useState([]);
  const [subServiceInput, setSubServiceInput] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingSubServicesList, setEditingSubServicesList] = useState([]);
  const [editingSubServiceInput, setEditingSubServiceInput] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [typeName, setTypeName] = useState('');
  const [itemLabel, setItemLabel] = useState('');
  const [itemValue, setItemValue] = useState('');
  const [feedbackSetTitle, setFeedbackSetTitle] = useState('');
  const [feedbackQuestionSetId, setFeedbackQuestionSetId] = useState('');
  const [feedbackQuestionText, setFeedbackQuestionText] = useState('');
  const [editingProviderId, setEditingProviderId] = useState('');
  const [providerFirstName, setProviderFirstName] = useState('');
  const [providerLastName, setProviderLastName] = useState('');
  const [providerPhoneNumber, setProviderPhoneNumber] = useState('');
  const [providerServiceCategory, setProviderServiceCategory] = useState('');
  const [providerServiceSubCategory, setProviderServiceSubCategory] = useState('');
  const [providerServices, setProviderServices] = useState([]);
  const queryClient = useQueryClient();
  const { isAuthenticated, loading, actualRole, impersonateUser } = useAuth();
  const canLoadAdminData = !loading && isAuthenticated && actualRole === 'admin';

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    enabled: canLoadAdminData,
    queryFn: async () => {
      const response = await apiInstance.get('/api/admin/dashboard-stats');
      return response.data;
    },
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['admin-bookings'],
    enabled: canLoadAdminData,
    queryFn: async () => {
      const response = await apiInstance.get('/api/admin/bookings');
      return response.data || [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    enabled: canLoadAdminData,
    queryFn: async () => {
      const response = await apiInstance.get('/api/admin/users');
      return response.data || [];
    },
  });

  const { data: serviceCategories = [] } = useQuery({
    queryKey: ['service-categories-admin'],
    enabled: canLoadAdminData,
    queryFn: async () => {
      const response = await apiInstance.get('/api/services');
      return response.data || [];
    },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['payment-transactions-admin'],
    enabled: canLoadAdminData,
    queryFn: async () => {
      const response = await apiInstance.get('/api/payments/transactions');
      return response.data || [];
    },
  });

  const {
    types,
    items,
    createType,
    createItem,
    deleteType,
    deleteItem,
    isSaving: isMasterDataSaving,
  } = useMasterData(selectedTypeId || undefined);

  const {
    questionSets,
    createQuestionSet,
    createQuestion,
    responses,
    isSaving: isFeedbackSaving,
  } = useFeedback(feedbackQuestionSetId || undefined);

  const refreshAdminData = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['service-categories-admin'] });
    queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    queryClient.invalidateQueries({ queryKey: ['payment-transactions-admin'] });
  };

  const createUser = useMutation({
    mutationFn: async () => {
      await apiInstance.post('/api/admin/users', {
        email: newUserEmail,
        password: newUserPassword,
        metadata: { role: newUserRole },
      });
    },
    onSuccess: () => {
      setUserMutationError('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('client');
      refreshAdminData();
    },
    onError: (error) => {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Unable to create user at this time.';
      setUserMutationError(message);
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (id) => {
      await apiInstance.delete(`/api/admin/users/${id}`);
    },
    onSuccess: refreshAdminData,
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ id, role }) => {
      const user = users.find((item) => item.id === id);
      const metadata = {
        ...(user?.user_metadata || {}),
        role,
      };
      await apiInstance.put(`/api/admin/users/${id}`, { metadata });
    },
    onSuccess: refreshAdminData,
  });

  const updateProviderDetails = useMutation({
    mutationFn: async ({ id, metadata }) => {
      await apiInstance.put(`/api/admin/users/${id}`, { metadata });
    },
    onSuccess: () => {
      setEditingProviderId('');
      setProviderFirstName('');
      setProviderLastName('');
      setProviderPhoneNumber('');
      setProviderServiceCategory('');
      setProviderServiceSubCategory('');
      setProviderServices([]);
      refreshAdminData();
    },
  });

  const createCategory = useMutation({
    mutationFn: async () => {
      const finalSubServices = withSubCategory(subServicesList, subServiceInput);

      await apiInstance.post('/api/services', {
        name: categoryName,
        subServices: finalSubServices,
      });
    },
    onSuccess: () => {
      setServiceMutationError('');
      setCategoryName('');
      setSubServicesList([]);
      setSubServiceInput('');
      refreshAdminData();
    },
    onError: (error) => {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Unable to create service category at this time.';
      setServiceMutationError(message);
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, name, subServicesList }) => {
      const finalSubServices = withSubCategory(subServicesList, editingSubServiceInput);

      await apiInstance.put(`/api/services/${id}`, {
        name,
        subServices: finalSubServices,
      });
    },
    onSuccess: () => {
      setServiceMutationError('');
      setEditingCategoryId('');
      setEditingCategoryName('');
      setEditingSubServicesList([]);
      setEditingSubServiceInput('');
      refreshAdminData();
    },
    onError: (error) => {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Unable to update service category at this time.';
      setServiceMutationError(message);
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id) => {
      await apiInstance.delete(`/api/services/${id}`);
    },
    onSuccess: () => {
      setServiceMutationError('');
      if (editingCategoryId === id) {
        setEditingCategoryId('');
        setEditingCategoryName('');
        setEditingSubServicesList([]);
        setEditingSubServiceInput('');
      }
      refreshAdminData();
    },
    onError: (error) => {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Unable to remove service category at this time.';
      setServiceMutationError(message);
    },
  });

  const totals = useMemo(() => {
    const totalRevenue = transactions
      .filter((item) => item.status === 'succeeded')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      totalRevenue,
      totalTransactions: transactions.length,
    };
  }, [transactions]);

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Appointments sheet
    const appointmentsData = bookings.map(booking => ({
      'Appointment Number': booking.appointment_number,
      'Client': booking.client_name || 'Unknown',
      'Provider': booking.provider_name || 'Unknown',
      'Service Category': booking.service_category,
      'Date': booking.appointment_date,
      'Status': booking.status,
      'Price': booking.price,
      'Created': booking.created_at,
    }));
    const appointmentsSheet = XLSX.utils.json_to_sheet(appointmentsData);
    XLSX.utils.book_append_sheet(workbook, appointmentsSheet, 'Appointments');

    // Users sheet
    const usersData = users.map(user => ({
      'Email': user.email,
      'Role': user.user_metadata?.role || 'client',
      'First Name': user.user_metadata?.firstName || '',
      'Last Name': user.user_metadata?.lastName || '',
      'Created': user.created_at,
      'Last Sign In': user.last_sign_in_at,
    }));
    const usersSheet = XLSX.utils.json_to_sheet(usersData);
    XLSX.utils.book_append_sheet(workbook, usersSheet, 'Users');

    // Transactions sheet
    const transactionsData = transactions.map(tx => ({
      'ID': tx.id,
      'Appointment': tx.appointment_id,
      'Amount': tx.amount,
      'Currency': tx.currency,
      'Status': tx.status,
      'Created': tx.created_at,
    }));
    const transactionsSheet = XLSX.utils.json_to_sheet(transactionsData);
    XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transactions');

    // Generate filename with current date
    const filename = `smartappointment-report-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const appointmentSummary = useMemo(() => {
    const summary = {
      booked: 0,
      rejected: 0,
      approved: 0,
      completed: 0,
    };

    bookings.forEach((booking) => {
      const status = String(booking.status || '').toLowerCase();
      if (status === 'booked' || status === 'pending') {
        summary.booked += 1;
        return;
      }

      if (status === 'declined' || status === 'rejected' || status === 'cancelled') {
        summary.rejected += 1;
        return;
      }

      if (status === 'approved' || status === 'confirmed') {
        summary.approved += 1;
        return;
      }

      if (status === 'completed') {
        summary.completed += 1;
      }
    });

    return summary;
  }, [bookings]);

  const paymentStatusSummary = useMemo(() => {
    return transactions.reduce((accumulator, transaction) => {
      const status = String(transaction.status || 'unknown').toLowerCase();
      accumulator[status] = (accumulator[status] || 0) + 1;
      return accumulator;
    }, {});
  }, [transactions]);

  const appointmentStatusChartData = useMemo(
    () => ({
      labels: ['Booked', 'Rejected', 'Approved', 'Completed'],
      datasets: [
        {
          label: 'Appointments',
          data: [
            appointmentSummary.booked,
            appointmentSummary.rejected,
            appointmentSummary.approved,
            appointmentSummary.completed,
          ],
          backgroundColor: ['#10b981', '#f43f5e', '#f59e0b', '#22c55e'],
          borderRadius: 8,
        },
      ],
    }),
    [appointmentSummary]
  );

  const paymentStatusChartData = useMemo(() => {
    const entries = Object.entries(paymentStatusSummary);
    return {
      labels: entries.map(([status]) => status),
      datasets: [
        {
          data: entries.map(([, count]) => count),
          backgroundColor: ['#10b981', '#22c55e', '#f59e0b', '#f43f5e', '#fb7185', '#64748b'],
          borderWidth: 1,
        },
      ],
    };
  }, [paymentStatusSummary]);

  const chartHoverCursor = (_event, elements, chart) => {
    if (!chart?.canvas) {
      return;
    }

    chart.canvas.style.cursor = elements.length ? 'pointer' : 'default';
  };

  const appointmentChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: true,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(18, 40, 80, 0.92)',
          padding: 10,
          cornerRadius: 10,
        },
      },
      onHover: chartHoverCursor,
    }),
    []
  );

  const paymentChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: true,
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(18, 40, 80, 0.92)',
          padding: 10,
          cornerRadius: 10,
        },
      },
      onHover: chartHoverCursor,
    }),
    []
  );

  const selectedProviderCategory = serviceCategories.find((item) => item.name === providerServiceCategory);

  const addProviderService = () => {
    if (!providerServiceCategory || !providerServiceSubCategory) {
      return;
    }

    const alreadyExists = providerServices.some(
      (item) =>
        item.category === providerServiceCategory &&
        item.subService === providerServiceSubCategory
    );

    if (alreadyExists) {
      return;
    }

    setProviderServices((current) => [
      ...current,
      {
        category: providerServiceCategory,
        subService: providerServiceSubCategory,
      },
    ]);
    setProviderServiceSubCategory('');
  };

  const busy =
    createUser.isPending ||
    deleteUser.isPending ||
    updateUserRole.isPending ||
    updateProviderDetails.isPending ||
    createCategory.isPending ||
    updateCategory.isPending ||
    deleteCategory.isPending ||
    isMasterDataSaving ||
    isFeedbackSaving;

  const showSectionTabs = mode === 'all';
  const isDashboardSectionVisible = showSectionTabs ? activeSection === 'Dashboard' : mode === 'dashboard';
  const isOperationsSectionVisible = showSectionTabs ? activeSection === 'Admin Operations' : mode === 'operations';

  return (
    <section className="app-card space-y-4">
      <div className="app-page-header">
        <h1 className="app-page-title">Admin Dashboard</h1>
        <p className="app-page-subtitle">
          Monitor appointments, payments, and platform operations from a single workspace.
        </p>
      </div>

      <div className={`grid gap-4 ${isOperationsSectionVisible ? 'lg:grid-cols-[260px,1fr]' : ''}`}>
        {isOperationsSectionVisible && (
        <aside className="app-card-tight p-3">
          <div className="space-y-2">
            {(showSectionTabs ? sectionTabs : [{ key: 'Admin Operations', label: 'Admin Operations', icon: Cog6ToothIcon }]).map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.key;

              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(section.key)}
                  className={`flex min-h-[var(--app-control-height)] w-full items-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${
                    active
                      ? 'app-surface-muted border-[var(--app-nav-link-active-border)] text-[var(--app-nav-link-active-text)] shadow-[0_0_16px_rgba(var(--accent-main-rgb),0.25)]'
                      : 'border-transparent text-[var(--app-nav-link-text)] hover:border-[var(--app-nav-border)] hover:bg-[var(--app-nav-link-hover-bg)]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {section.label}
                </button>
              );
            })}
          </div>

          {activeSection === 'Admin Operations' && (
            <div className="mt-4 border-t border-[var(--app-nav-border)] pt-4">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--app-nav-link-text)]">Operations</p>
              <div className="space-y-2">
                {operationTabItems.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex min-h-[var(--app-control-height)] w-full items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
                        active
                          ? 'app-surface-muted border-[var(--app-nav-link-active-border)] text-[var(--app-nav-link-active-text)]'
                          : 'border-transparent text-[var(--app-nav-link-text)] hover:border-[var(--app-nav-border)] hover:bg-[var(--app-nav-link-hover-bg)]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
        )}

        <div className="space-y-4">

      {isDashboardSectionVisible && (
        <>
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-slate-900">Dashboard Overview</h1>
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export to Excel
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="app-card-tight border-l-4 border-l-emerald-500">
              <p className="text-sm text-slate-500">Booked</p>
              <p className="text-2xl font-semibold text-slate-900">{appointmentSummary.booked}</p>
            </div>
            <div className="app-card-tight border-l-4 border-l-rose-500">
              <p className="text-sm text-slate-500">Rejected</p>
              <p className="text-2xl font-semibold text-slate-900">{appointmentSummary.rejected}</p>
            </div>
            <div className="app-card-tight border-l-4 border-l-amber-500">
              <p className="text-sm text-slate-500">Approved</p>
              <p className="text-2xl font-semibold text-slate-900">{appointmentSummary.approved}</p>
            </div>
            <div className="app-card-tight border-l-4 border-l-emerald-500">
              <p className="text-sm text-slate-500">Completed</p>
              <p className="text-2xl font-semibold text-slate-900">{appointmentSummary.completed}</p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="app-card-tight">
              <h2 className="text-base font-semibold text-slate-900">Appointment Status Summary</h2>
              <div className="mt-3 h-56">
                <Bar
                  data={appointmentStatusChartData}
                  options={appointmentChartOptions}
                />
              </div>
            </div>

            <div className="app-card-tight">
              <h2 className="text-base font-semibold text-slate-900">Payment Status Distribution</h2>
              <div className="mt-3 h-56">
                <Pie
                  data={paymentStatusChartData}
                  options={paymentChartOptions}
                />
              </div>
            </div>
          </div>

      <div className="grid gap-3 lg:grid-cols-2">
      <div className="app-card-tight">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Appointments</h2>
          {bookings.length > 5 && (
            <p className="text-xs text-slate-500">Showing latest 5</p>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {bookings.slice(0, 5).map((booking) => (
            <div key={booking.id} className="rounded-md border border-slate-200 p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-sm font-medium text-slate-900">{booking.appointment_number || booking.id}</p>
              <p className="text-sm text-slate-600">{booking.service_category} · {booking.service_subtype}</p>
              <p className="text-xs text-slate-500">Status: {booking.status}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="app-card-tight">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Payments</h2>
          <p className="text-sm text-slate-600">Revenue (Succeeded): {formatRands(totals.totalRevenue)}</p>
        </div>
        <div className="mt-3 space-y-2">
          {transactions.slice(0, 5).map((transaction) => (
            <div key={transaction.id} className="rounded border border-slate-200 p-3 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="font-medium text-slate-900">{formatRands(transaction.amount)} · {(transaction.currency || 'ZAR').toUpperCase()}</p>
              <p className="text-slate-600">Status: {transaction.status}</p>
              <p className="text-xs text-slate-500">Appointment: {transaction.appointment_id}</p>
            </div>
          ))}
        </div>
      </div>
      </div>
      </>
      )}

      {isOperationsSectionVisible && activeTab === 'Users' && (
        <div className="app-card-tight space-y-3">
          <h2 className="text-base font-semibold text-slate-900">User Administration</h2>
          <div className="app-form-grid grid gap-2 sm:grid-cols-4">
            <input value={newUserEmail} onChange={(event) => setNewUserEmail(event.target.value)} placeholder="Email address" className="app-input" />
            <input value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} placeholder="Temporary password" className="app-input" />
            <AppSelectField
              label="Role"
              value={newUserRole}
              onChange={setNewUserRole}
              options={[
                { value: 'client', label: 'Client' },
                { value: 'provider', label: 'Provider' },
                { value: 'admin', label: 'Admin' },
              ]}
              placeholder="Select role"
            />
            <button type="button" disabled={busy} onClick={() => createUser.mutate()} className="app-btn-primary">Create user</button>
          </div>

          {userMutationError && (
            <p className="text-sm text-rose-700">{userMutationError}</p>
          )}

          <div className="space-y-2">
            {users.map((user) => {
              const role = user.user_metadata?.role || user.app_metadata?.role || 'client';
              const isProvider = role === 'provider';
              const isEditingProvider = editingProviderId === user.id;
              return (
                <div key={user.id} className="rounded border border-slate-200 p-3 text-sm">
                  <div className="w-full">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700">{user.email}</p>
                      </div>
                      <div className="w-full">
                          <AppSelectField
                            label="Role"
                            value={role}
                            onChange={(value) => updateUserRole.mutate({ id: user.id, role: value })}
                            options={[
                              { value: 'client', label: 'Client' },
                              { value: 'provider', label: 'Provider' },
                              { value: 'admin', label: 'Admin' },
                            ]}
                            placeholder="Select role"
                          />
                      </div>
                      <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                        {isProvider && !isEditingProvider && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProviderId(user.id);
                              setProviderFirstName(user.user_metadata?.firstName || '');
                              setProviderLastName(user.user_metadata?.lastName || '');
                              setProviderPhoneNumber(user.user_metadata?.phoneNumber || '');
                              setProviderServiceCategory('');
                              setProviderServiceSubCategory('');
                              setProviderServices(user.user_metadata?.services || []);
                            }}
                            disabled={busy}
                            className="app-btn-secondary"
                          >
                            Edit provider
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            impersonateUser({
                              id: user.id,
                              email: user.email,
                              user_metadata: {
                                ...(user.user_metadata || {}),
                                role,
                              },
                              app_metadata: {
                                ...(user.app_metadata || {}),
                                role,
                              },
                            });
                            router.push('/Dashboard');
                          }}
                          disabled={busy}
                          aria-label={`Login as ${user.email}`}
                          title={`Login as ${user.email}`}
                          className="app-btn-secondary w-[var(--app-control-height)] px-0"
                        >
                          <UserCircleIcon className="h-5 w-5" />
                        </button>
                        <button type="button" onClick={() => deleteUser.mutate(user.id)} disabled={busy} className="app-btn-danger">Remove</button>
                      </div>
                    </div>

                    {isProvider && isEditingProvider && (
                      <div className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                        <input
                          value={providerFirstName}
                          onChange={(event) => setProviderFirstName(event.target.value)}
                          placeholder="First name"
                          className="app-input"
                        />
                        <input
                          value={providerLastName}
                          onChange={(event) => setProviderLastName(event.target.value)}
                          placeholder="Last name"
                          className="app-input"
                        />
                        <input
                          value={providerPhoneNumber}
                          onChange={(event) => setProviderPhoneNumber(event.target.value)}
                          placeholder="Phone number"
                          className="app-input sm:col-span-2"
                        />

                        <AppSelectField
                          label="Service category"
                          value={providerServiceCategory}
                          onChange={(value) => {
                            setProviderServiceCategory(value);
                            setProviderServiceSubCategory('');
                          }}
                          options={serviceCategories.map((item) => ({ value: item.name, label: item.name }))}
                          placeholder="Select category"
                        />
                        <AppSelectField
                          label="Service sub-category"
                          value={providerServiceSubCategory}
                          onChange={setProviderServiceSubCategory}
                          options={(selectedProviderCategory?.subServices || []).map((item) => ({ value: item, label: item }))}
                          placeholder="Select sub-category"
                        />

                        <div className="sm:col-span-2 flex flex-wrap gap-2">
                          <button type="button" onClick={addProviderService} disabled={busy} className="app-btn-secondary">
                            Add service
                          </button>
                          {providerServices.map((service) => (
                            <Chip
                              key={`${service.category}-${service.subService}`}
                              label={`${service.category} · ${service.subService}`}
                              color="primary"
                              variant="outlined"
                              size="small"
                              onDelete={() =>
                                setProviderServices((current) =>
                                  current.filter(
                                    (item) =>
                                      !(item.category === service.category && item.subService === service.subService)
                                  )
                                )
                              }
                            />
                          ))}
                        </div>

                        <div className="sm:col-span-2 flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              updateProviderDetails.mutate({
                                id: user.id,
                                metadata: {
                                  ...(user.user_metadata || {}),
                                  role: 'provider',
                                  firstName: providerFirstName,
                                  lastName: providerLastName,
                                  phoneNumber: providerPhoneNumber,
                                  services: providerServices,
                                },
                              })
                            }
                            className="app-btn-primary"
                          >
                            Save provider details
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProviderId('');
                              setProviderFirstName('');
                              setProviderLastName('');
                              setProviderPhoneNumber('');
                              setProviderServiceCategory('');
                              setProviderServiceSubCategory('');
                              setProviderServices([]);
                            }}
                            className="app-btn-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isOperationsSectionVisible && activeTab === 'Services' && (
        <div className="app-card-tight space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Service Categories and Sub-categories</h2>
          <div className="space-y-2">
            <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Category name" className="app-input" />
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="text-xs font-medium text-slate-600">Sub-categories</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {subServicesList.length === 0 && (
                  <p className="text-xs text-slate-500">No sub-categories added.</p>
                )}
                {subServicesList.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    onDelete={() => setSubServicesList((current) => current.filter((value) => value !== item))}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={subServiceInput}
                  onChange={(event) => setSubServiceInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      setSubServicesList((current) => withSubCategory(current, subServiceInput));
                      setSubServiceInput('');
                    }
                  }}
                  placeholder="Type sub-category and press Enter"
                  className="app-input"
                />
                <button
                  type="button"
                  className="app-btn-secondary whitespace-nowrap"
                  onClick={() => {
                    setSubServicesList((current) => withSubCategory(current, subServiceInput));
                    setSubServiceInput('');
                  }}
                >
                  Add sub-category
                </button>
              </div>
            </div>
            <button type="button" onClick={() => createCategory.mutate()} disabled={busy} className="app-btn-primary">Add category</button>
          </div>

          {serviceMutationError && (
            <p className="text-sm text-rose-700">{serviceMutationError}</p>
          )}

          <div className="space-y-2">
            {serviceCategories.map((category) => (
              <div key={category.id || category.name} className="rounded border border-slate-200 p-3 text-sm">
                {editingCategoryId === category.id ? (
                  <div className="space-y-2">
                    <input
                      value={editingCategoryName}
                      onChange={(event) => setEditingCategoryName(event.target.value)}
                      placeholder="Category name"
                      className="app-input"
                    />
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <p className="text-xs font-medium text-slate-600">Sub-categories</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {editingSubServicesList.length === 0 && (
                          <p className="text-xs text-slate-500">No sub-categories added.</p>
                        )}
                        {editingSubServicesList.map((item) => (
                          <Chip
                            key={`${category.id}-${item}`}
                            label={item}
                            onDelete={() => setEditingSubServicesList((current) => current.filter((value) => value !== item))}
                            color="primary"
                            variant="outlined"
                            size="small"
                          />
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          value={editingSubServiceInput}
                          onChange={(event) => setEditingSubServiceInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              setEditingSubServicesList((current) => withSubCategory(current, editingSubServiceInput));
                              setEditingSubServiceInput('');
                            }
                          }}
                          placeholder="Type sub-category and press Enter"
                          className="app-input"
                        />
                        <button
                          type="button"
                          className="app-btn-secondary whitespace-nowrap"
                          onClick={() => {
                            setEditingSubServicesList((current) => withSubCategory(current, editingSubServiceInput));
                            setEditingSubServiceInput('');
                          }}
                        >
                          Add sub-category
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy || !editingCategoryName.trim()}
                        onClick={() =>
                          updateCategory.mutate({
                            id: category.id,
                            name: editingCategoryName.trim(),
                            subServicesList: editingSubServicesList,
                          })
                        }
                        className="app-btn-primary"
                      >
                        Save changes
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategoryId('');
                          setEditingCategoryName('');
                          setEditingSubServicesList([]);
                          setEditingSubServiceInput('');
                        }}
                        className="app-btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{category.name}</p>
                      <p className="text-slate-600">{(category.subServices || []).join(', ')}</p>
                    </div>
                    {category.id && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setServiceMutationError('');
                            setEditingCategoryId(category.id);
                            setEditingCategoryName(category.name || '');
                            setEditingSubServicesList(category.subServices || []);
                            setEditingSubServiceInput('');
                          }}
                          disabled={busy}
                          className="app-btn-secondary"
                        >
                          Edit
                        </button>
                        <button type="button" onClick={() => deleteCategory.mutate(category.id)} disabled={busy} className="app-btn-danger">Remove</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isOperationsSectionVisible && activeTab === 'Master Data' && (
        <div className="app-card-tight space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Master Data Management (Dynamic Dropdowns)</h2>
          <div className="app-form-grid grid gap-2 sm:grid-cols-3">
            <input value={typeCode} onChange={(event) => setTypeCode(event.target.value)} placeholder="Type code" className="app-input" />
            <input value={typeName} onChange={(event) => setTypeName(event.target.value)} placeholder="Type name" className="app-input" />
            <button type="button" disabled={busy} onClick={() => createType({ code: typeCode, name: typeName })} className="app-btn-primary">Create type</button>
          </div>

          <div className="space-y-2">
            {types.map((type) => (
              <div key={type.id} className="rounded border border-slate-200 p-3 text-sm flex items-center justify-between gap-3">
                <button type="button" onClick={() => setSelectedTypeId(type.id)} className="font-medium text-slate-900 text-left">{type.name} ({type.code})</button>
                <button type="button" disabled={busy} onClick={() => deleteType(type.id)} className="app-btn-danger">Remove</button>
              </div>
            ))}
          </div>

          <div className="app-form-grid grid gap-2 sm:grid-cols-3">
            <input value={itemLabel} onChange={(event) => setItemLabel(event.target.value)} placeholder="Item label" className="app-input" />
            <input value={itemValue} onChange={(event) => setItemValue(event.target.value)} placeholder="Item value" className="app-input" />
            <button
              type="button"
              disabled={busy || !selectedTypeId}
              onClick={() => createItem({ type_id: selectedTypeId, label: itemLabel, value: itemValue })}
              className="app-btn-primary"
            >
              Add item
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded border border-slate-200 p-3 text-sm flex items-center justify-between">
                <span>{item.label} ({item.value})</span>
                <button type="button" disabled={busy} onClick={() => deleteItem(item.id)} className="app-btn-danger">Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isOperationsSectionVisible && activeTab === 'Feedback' && (
        <div className="app-card-tight space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Feedback Questions</h2>
          <div className="app-form-grid grid gap-2 sm:grid-cols-3">
            <input value={feedbackSetTitle} onChange={(event) => setFeedbackSetTitle(event.target.value)} placeholder="Question set title" className="app-input" />
            <button type="button" disabled={busy} onClick={() => createQuestionSet({ title: feedbackSetTitle, scope: 'admin_global' })} className="app-btn-primary">Create set</button>
            <AppSelectField
              label="Feedback set"
              value={feedbackQuestionSetId}
              onChange={setFeedbackQuestionSetId}
              options={questionSets.map((set) => ({ value: set.id, label: set.title }))}
              placeholder="Select a set"
            />
          </div>

          <div className="app-form-grid grid gap-2 sm:grid-cols-3">
            <input value={feedbackQuestionText} onChange={(event) => setFeedbackQuestionText(event.target.value)} placeholder="Question text" className="app-input" />
            <button type="button" disabled={busy || !feedbackQuestionSetId} onClick={() => createQuestion({ question_set_id: feedbackQuestionSetId, question_text: feedbackQuestionText, answer_type: 'text' })} className="app-btn-primary">Add question</button>
          </div>

          <p className="text-sm text-slate-600">Total feedback submissions: {responses.length}</p>
        </div>
      )}

        </div>
      </div>

    </section>
  );
};

export default AdminDashboard;
