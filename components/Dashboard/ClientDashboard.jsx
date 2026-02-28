import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useAppointments } from '@/hooks/useAppointments';
import { usePayments } from '@/hooks/usePayments';
import { useFeedback } from '@/hooks/useFeedback';
import StripePaymentMethodForm from '@/components/Payments/StripePaymentMethodForm';
import { useAuth } from '@/hooks/useAuth';
import AppointmentChatPanel from '@/components/Chat/AppointmentChatPanel';
import AppSelectField from '@/components/General/AppSelectField';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

const tabs = ['Bookings', 'Payment Methods', 'Spend Summary', 'Feedback'];

const ClientDashboard = () => {
    const [activeTab, setActiveTab] = useState('Bookings');
    const [feedbackAppointmentId, setFeedbackAppointmentId] = useState('');
    const [feedbackSetId, setFeedbackSetId] = useState('');
    const [feedbackAnswer, setFeedbackAnswer] = useState('');
    const [open, setOpen] = useState(false);
    const { user, role } = useAuth();

    const { data = [], isLoading } = useAppointments();
    const { methods, transactions, isSaving: paymentSaving } = usePayments();
    const { questionSets, questions, submitFeedbackResponse, isSaving: feedbackSaving } = useFeedback(feedbackSetId || undefined);

    const now = dayjs();
    const upcoming = data.filter((item) => dayjs(item.appointment_date).isAfter(now));
    const history = data.filter((item) => dayjs(item.appointment_date).isBefore(now));
    const completed = data.filter((item) => item.status === 'completed');
    const firstQuestion = questions[0];

    const spend = useMemo(() => {
        const succeeded = (transactions || []).filter((item) => item.status === 'succeeded');
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

        return { total, byMonth, byCategory };
    }, [transactions, data]);

    const busy = paymentSaving || feedbackSaving;

    return (
        <>
            <section className="space-y-4">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">Client Dashboard</h1>
                        <p className="text-sm text-slate-600">Track bookings, payments, and submit service feedback.</p>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Live client view
                    </span>
                </header>

                <div className="flex flex-wrap gap-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`app-tab ${activeTab === tab ? 'app-tab-active' : ''
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {activeTab === 'Bookings' && (
                    <>
                        <div className="app-card-tight">
                            <h2 className="text-base font-semibold text-slate-900">Upcoming Appointments</h2>
                            {isLoading ? (
                                <LoadingScreen message="Loading appointments..." size="small" />
                            ) : (
                                <div className="mt-3 space-y-2">
                                    {upcoming.length === 0 && <p className="text-sm text-slate-600">No upcoming appointments.</p>}
                                    {upcoming.map((item) => (
                                        <div key={item.id} className="rounded-md border border-slate-200 p-3">
                                            <p className="text-sm font-medium text-slate-900">{item.title}</p>
                                            <p className="text-xs text-slate-500">{item.appointment_number} · {item.status}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="app-card-tight">
                            <h2 className="text-base font-semibold text-slate-900">Past Bookings</h2>
                            {isLoading ? (
                                <LoadingScreen message="Loading bookings..." size="small" />
                            ) : (
                                <div className="mt-3 space-y-2">
                                    {history.length === 0 && <p className="text-sm text-slate-600">No past appointments are available.</p>}
                                    {history.map((item) => (
                                        <div key={item.id} className="rounded-md border border-slate-200 p-3">
                                            <p className="text-sm font-medium text-slate-900">{item.title}</p>
                                            <p className="text-xs text-slate-500">{item.appointment_number} · {item.status}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </>
                )}

                {activeTab === 'Payment Methods' && (
                    <div className="app-card-tight space-y-3">
                        <h2 className="text-base font-semibold text-slate-900">Payment Methods (Stripe)</h2>
                        <p className="text-sm text-slate-600">Add your card securely using Stripe Elements.</p>
                        <StripePaymentMethodForm />

                        <div className="space-y-2">
                            {methods.map((method) => (
                                <div key={method.id} className="rounded border border-slate-200 p-3 text-sm">
                                    <p className="font-medium text-slate-900">{method.brand || 'card'} •••• {method.last4 || '----'}</p>
                                    <p className="text-slate-600">Default: {method.is_default ? 'Yes' : 'No'}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'Spend Summary' && (
                    <div className="app-card-tight space-y-3">
                        <h2 className="text-base font-semibold text-slate-900">Spend Analytics</h2>
                        <p className="text-2xl font-semibold text-slate-900">Total Spent: ${spend.total.toFixed(2)}</p>
                        <h3 className="text-sm font-semibold text-slate-700">By Service Category</h3>
                        <div className="space-y-2">
                            {Object.entries(spend.byCategory).map(([category, amount]) => (
                                <div key={category} className="rounded border border-slate-200 p-3 text-sm flex items-center justify-between">
                                    <span>{category}</span>
                                    <span className="font-medium text-slate-900">${Number(amount).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-700">Over Time (Monthly)</h3>
                        <div className="space-y-2">
                            {Object.entries(spend.byMonth).map(([period, amount]) => (
                                <div key={period} className="rounded border border-slate-200 p-3 text-sm flex items-center justify-between">
                                    <span>{period}</span>
                                    <span className="font-medium text-slate-900">${Number(amount).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'Feedback' && (
                    <div className="app-card-tight space-y-3">
                        <h2 className="text-base font-semibold text-slate-900">Submit Feedback</h2>
                        <div className="app-form-grid grid gap-2 sm:grid-cols-4">
                            <AppSelectField
                                label="Appointment"
                                value={feedbackAppointmentId}
                                onChange={setFeedbackAppointmentId}
                                options={completed.map((item) => ({
                                    value: item.id,
                                    label: item.appointment_number || item.title,
                                }))}
                                placeholder="Select a completed appointment"
                            />
                            <AppSelectField
                                label="Feedback set"
                                value={feedbackSetId}
                                onChange={setFeedbackSetId}
                                options={questionSets.map((set) => ({ value: set.id, label: set.title }))}
                                placeholder="Select a feedback set"
                            />
                            <input value={feedbackAnswer} onChange={(event) => setFeedbackAnswer(event.target.value)} placeholder={firstQuestion ? firstQuestion.question_text : 'Enter your feedback'} className="app-input" />
                            <button
                                type="button"
                                disabled={busy || !feedbackAppointmentId || !firstQuestion?.id || !feedbackAnswer}
                                onClick={() =>
                                    submitFeedbackResponse({
                                        appointment_id: feedbackAppointmentId,
                                        items: [{ question_id: firstQuestion.id, answer_value: { value: feedbackAnswer } }],
                                    })
                                }
                                className="app-btn-primary"
                            >
                                Submit feedback
                            </button>
                        </div>
                        <p className="text-xs text-slate-500">Feedback is available for completed appointments and requires at least one question in the selected set.</p>
                    </div>
                )}
            </section>

            {/* Floating Chat Button */}
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="fixed bottom-4 right-4 z-40 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow"
            >
                {open ? 'Close Chat' : 'Chat'}
            </button>

            {open && (
                <aside className="fixed right-4 top-20 z-40 flex h-[70vh] w-full max-w-sm flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
                    <AppointmentChatPanel appointments={data} role={role} userId={user?.id} />
                </aside>
            )}
        </>
    );
};

export default ClientDashboard;
