import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppointments } from '@/hooks/useAppointments';
import { useProviderServices } from '@/hooks/useProviderServices';
import { usePayments } from '@/hooks/usePayments';
import { useFeedback } from '@/hooks/useFeedback';
import { useServices } from '@/hooks/useServices';
import { useAuth } from '@/hooks/useAuth';
import AppointmentChatPanel from '@/components/Chat/AppointmentChatPanel';
import AppSelectField from '@/components/General/AppSelectField';
import LoadingScreen from '@/components/General/LoadingScreen';

const tabs = ['Bookings', 'Services & Pricing', 'Payments', 'Earnings', 'Feedback Questions'];

const ProviderDashboard = () => {
  const [activeTab, setActiveTab] = useState('Bookings');
  const [categoryId, setCategoryId] = useState('');
  const [subServiceId, setSubServiceId] = useState('');
  const [pricingType, setPricingType] = useState('fixed');
  const [rate, setRate] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [paymentAppointmentId, setPaymentAppointmentId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [lastAutoSyncAt, setLastAutoSyncAt] = useState('');
  const [feedbackSetTitle, setFeedbackSetTitle] = useState('');
  const [selectedSetId, setSelectedSetId] = useState('');
  const [questionText, setQuestionText] = useState('');
  const isAutoSyncRunningRef = useRef(false);
  const { user, role } = useAuth();

  const { data = [], providerDecision, isSaving, isLoading } = useAppointments();
  const { data: providerServices = [], createProviderService, deleteProviderService, isSaving: pricingSaving } = useProviderServices();
  const { initiatePayment, syncPaymentIntent, transactions, isSaving: paymentSaving } = usePayments();
  const { questionSets, createQuestionSet, createQuestion, isSaving: feedbackSaving } = useFeedback(selectedSetId || undefined);
  const { data: serviceCategories = [] } = useServices();

  const pending = data.filter((item) => item.status === 'booked' || item.status === 'pending');
  const upcoming = data.filter((item) => item.status === 'approved');
  const providerTransactions = transactions || [];

  const selectedCategory = serviceCategories.find((item) => item.id === categoryId || item.name === categoryId);

  const earnings = useMemo(() => {
    const succeeded = providerTransactions.filter((item) => item.status === 'succeeded');
    const total = succeeded.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const byMonth = succeeded.reduce((accumulator, item) => {
      const month = String(item.created_at || '').slice(0, 7) || 'unknown';
      accumulator[month] = (accumulator[month] || 0) + Number(item.amount || 0);
      return accumulator;
    }, {});

    const byCategory = succeeded.reduce((accumulator, item) => {
      const appointment = data.find((booking) => booking.id === item.appointment_id);
      const category = appointment?.service_category || 'Uncategorized';
      accumulator[category] = (accumulator[category] || 0) + Number(item.amount || 0);
      return accumulator;
    }, {});

    return {
      total,
      byMonth,
      byCategory,
    };
  }, [providerTransactions, data]);

  const busy = isSaving || pricingSaving || paymentSaving || feedbackSaving;

  useEffect(() => {
    if (activeTab !== 'Payments') {
      return undefined;
    }

    const intervalId = setInterval(async () => {
      if (isAutoSyncRunningRef.current || busy) {
        return;
      }

      const processingIntents = (providerTransactions || [])
        .filter((transaction) => ['processing', 'pending'].includes(transaction.status))
        .map((transaction) => transaction.stripe_payment_intent_id)
        .filter(Boolean);

      if (processingIntents.length === 0) {
        return;
      }

      isAutoSyncRunningRef.current = true;

      try {
        await Promise.all(processingIntents.map((intentId) => syncPaymentIntent(intentId)));
        setLastAutoSyncAt(new Date().toISOString());
      } catch (_error) {
        // Keep polling; transient failures should retry on next interval.
      } finally {
        isAutoSyncRunningRef.current = false;
      }
    }, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeTab, busy, providerTransactions, syncPaymentIntent]);

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Provider Dashboard</h1>
          <p className="text-sm text-slate-600">Manage bookings, services, payments, and feedback from one workspace.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Live provider view
        </span>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`app-tab ${
              activeTab === tab ? 'app-tab-active' : ''
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Bookings' && (
      <>
      <div className="app-card-tight">
        <h2 className="text-base font-semibold text-slate-900">Pending Approvals</h2>
        {isLoading ? (
          <LoadingScreen message="Loading bookings..." size="small" />
        ) : (
          <div className="mt-3 space-y-2">
            {pending.length === 0 && <p className="text-sm text-slate-600">No pending booking requests.</p>}
            {pending.map((item) => (
              <article key={item.id} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">{item.appointment_number}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => providerDecision({ id: item.id, status: 'approved' })}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => providerDecision({ id: item.id, status: 'declined' })}
                    className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Decline
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="app-card-tight">
        <h2 className="text-base font-semibold text-slate-900">Upcoming Approved Appointments</h2>
        {isLoading ? (
          <LoadingScreen message="Loading appointments..." size="small" />
        ) : (
          <div className="mt-3 space-y-2">
            {upcoming.length === 0 && <p className="text-sm text-slate-600">No approved upcoming appointments.</p>}
            {upcoming.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">{item.appointment_number} · {item.service_subtype}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <AppointmentChatPanel appointments={data} role={role} userId={user?.id} />

      </>
      )}

      {activeTab === 'Services & Pricing' && (
        <div className="app-card-tight space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Services and Pricing</h2>
          <div className="app-form-grid grid gap-2 sm:grid-cols-5">
            <AppSelectField
              label="Category"
              value={categoryId}
              onChange={setCategoryId}
              options={serviceCategories.map((category) => ({
                value: category.id || category.name,
                label: category.name,
              }))}
              placeholder="Select a category"
            />
            <AppSelectField
              label="Sub-category"
              value={subServiceId}
              onChange={setSubServiceId}
              options={(selectedCategory?.subServices || []).map((subService) => ({
                value: subService.id || subService,
                label: subService.name || subService,
              }))}
              placeholder="Select a sub-category"
            />
            <AppSelectField
              label="Pricing type"
              value={pricingType}
              onChange={setPricingType}
              options={[
                { value: 'fixed', label: 'Fixed' },
                { value: 'hourly', label: 'Hourly' },
              ]}
              placeholder="Select pricing type"
            />
            <input value={rate} onChange={(event) => setRate(event.target.value)} placeholder="Rate" className="app-input" />
            <button
              type="button"
              disabled={busy || !categoryId || !rate}
              onClick={() =>
                createProviderService({
                  category_id: categoryId,
                  sub_service_id: subServiceId || null,
                  pricing_type: pricingType,
                  rate: Number(rate),
                  currency,
                })
              }
              className="app-btn-primary"
            >
              Save pricing
            </button>
          </div>

          <div className="space-y-2">
            {providerServices.map((item) => (
              <div key={item.id} className="rounded border border-slate-200 p-3 text-sm flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{item.service_categories?.name || item.category_id}</p>
                  <p className="text-slate-600">{item.service_sub_services?.name || item.sub_service_id || 'General'} · {item.pricing_type} · {item.currency} {item.rate}</p>
                </div>
                <button type="button" disabled={busy} onClick={() => deleteProviderService(item.id)} className="app-btn-danger">Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Payments' && (
        <div className="app-card-tight space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Initiate Payment for Appointment</h2>
          <p className="text-xs text-slate-500">
            Auto-sync runs every 10s for pending/processing payments.
            {lastAutoSyncAt ? ` Last sync: ${new Date(lastAutoSyncAt).toLocaleTimeString()}` : ''}
          </p>
          <div className="app-form-grid grid gap-2 sm:grid-cols-3">
            <AppSelectField
              label="Appointment"
              value={paymentAppointmentId}
              onChange={setPaymentAppointmentId}
              options={upcoming.map((item) => ({
                value: item.id,
                label: item.appointment_number || item.title,
              }))}
              placeholder="Select an approved appointment"
            />
            <input value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="Amount" className="app-input" />
            <button
              type="button"
              disabled={busy || !paymentAppointmentId || !paymentAmount}
              onClick={() => initiatePayment({ appointmentId: paymentAppointmentId, amount: Number(paymentAmount), currency })}
              className="app-btn-primary"
            >
              Initiate payment
            </button>
          </div>

          <div className="space-y-2">
            {providerTransactions.slice(0, 10).map((transaction) => (
              <div key={transaction.id} className="rounded border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-900">${Number(transaction.amount || 0).toFixed(2)} · {transaction.currency}</p>
                <p className="text-slate-600">{transaction.status}</p>
                {transaction.stripe_payment_intent_id && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => syncPaymentIntent(transaction.stripe_payment_intent_id)}
                    className="mt-2 app-btn-primary"
                  >
                    Sync status
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Earnings' && (
        <div className="app-card-tight space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Earnings Summary</h2>
          <p className="text-2xl font-semibold text-slate-900">Total: ${earnings.total.toFixed(2)}</p>
          <h3 className="text-sm font-semibold text-slate-700">By Service Category</h3>
          <div className="space-y-2">
            {Object.entries(earnings.byCategory).map(([category, amount]) => (
              <div key={category} className="rounded border border-slate-200 p-3 text-sm flex items-center justify-between">
                <span>{category}</span>
                <span className="font-medium text-slate-900">${Number(amount).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <h3 className="text-sm font-semibold text-slate-700">Over Time (Monthly)</h3>
          <div className="space-y-2">
            {Object.entries(earnings.byMonth).map(([period, amount]) => (
              <div key={period} className="rounded border border-slate-200 p-3 text-sm flex items-center justify-between">
                <span>{period}</span>
                <span className="font-medium text-slate-900">${Number(amount).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Feedback Questions' && (
        <div className="app-card-tight space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Feedback Questions</h2>
          <div className="app-form-grid grid gap-2 sm:grid-cols-3">
            <input value={feedbackSetTitle} onChange={(event) => setFeedbackSetTitle(event.target.value)} placeholder="Question set title" className="app-input" />
            <button type="button" disabled={busy} onClick={() => createQuestionSet({ title: feedbackSetTitle })} className="app-btn-primary">Create set</button>
            <AppSelectField
              label="Question set"
              value={selectedSetId}
              onChange={setSelectedSetId}
              options={questionSets.map((set) => ({ value: set.id, label: set.title }))}
              placeholder="Select a set"
            />
          </div>

          <div className="app-form-grid grid gap-2 sm:grid-cols-3">
            <input value={questionText} onChange={(event) => setQuestionText(event.target.value)} placeholder="Question text" className="app-input" />
            <button type="button" disabled={busy || !selectedSetId} onClick={() => createQuestion({ question_set_id: selectedSetId, question_text: questionText, answer_type: 'text' })} className="app-btn-primary">Add question</button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProviderDashboard;
