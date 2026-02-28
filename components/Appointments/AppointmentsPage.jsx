import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useRouter } from 'next/router';
import AppointmentForm from '@/components/Appointments/AppointmentForm';
import AppointmentList from '@/components/Appointments/AppointmentList';
import { useAppointments } from '@/hooks/useAppointments';
import { useAuth } from '@/hooks/useAuth';
import { useServices } from '@/hooks/useServices';
import { useProviders } from '@/hooks/useProviders';

const emptyForm = {
  title: '',
  serviceCategory: '',
  serviceSubService: '',
  providerId: '',
  notes: '',
  appointmentDate: dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
  status: 'pending',
};

const AppointmentsPage = () => {
  const router = useRouter();
  const { isAuthenticated, loading, role, user } = useAuth();
  const canBook = role === 'client' || role === 'admin';
  const [editingItem, setEditingItem] = useState(null);
  const [createdReference, setCreatedReference] = useState('');
  const { data, isLoading, createAppointment, updateAppointment, deleteAppointment, isSaving } = useAppointments();
  const { data: services } = useServices();
  const { data: providers = [] } = useProviders({
    category: '',
    subService: '',
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/Login');
    }
  }, [isAuthenticated, loading, router]);

  const initialValues = useMemo(() => {
    if (!editingItem) {
      return emptyForm;
    }

    return {
      title: editingItem.title,
      serviceCategory: editingItem.service_category || editingItem.serviceCategory || '',
      serviceSubService: editingItem.service_subtype || editingItem.serviceSubService || '',
      providerId: editingItem.provider_id || '',
      notes: editingItem.notes || '',
      appointmentDate: dayjs(editingItem.appointment_date || editingItem.appointmentDate).format('YYYY-MM-DDTHH:mm'),
      status: editingItem.status || 'pending',
    };
  }, [editingItem]);

  if (!isAuthenticated) {
    return null;
  }

  const onSubmit = async (values) => {
    setCreatedReference('');

    const payload = {
      title: values.title,
      service_category: values.serviceCategory,
      service_subtype: values.serviceSubService,
      provider_id: values.providerId,
      client_id: user?.id,
      notes: values.notes,
      status: values.status,
      appointment_date: dayjs(values.appointmentDate).toISOString(),
    };

    if (editingItem?.id) {
      await updateAppointment({ id: editingItem.id, payload });
      setEditingItem(null);
      return;
    }

    const created = await createAppointment(payload);
    if (created?.appointment_number) {
      setCreatedReference(created.appointment_number);
    }
  };

  return (
    <section className="space-y-4">
      <header className="app-page-header flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="app-page-title">Appointments</h1>
          <p className="app-page-subtitle">Create and manage appointment requests and schedules.</p>
        </div>
        <span className="app-status-pill">
          <span className="app-status-dot" />
          Real-time updates enabled
        </span>
      </header>

      {canBook ? (
        <AppointmentForm
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={() => setEditingItem(null)}
          isSaving={isSaving}
          services={services || []}
          providers={providers}
          role={role}
        />
      ) : (
        <p className="app-card-tight text-sm text-slate-600">
          Service providers review and approve appointment requests in the dashboard.
        </p>
      )}

      {createdReference && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Booking confirmed. Appointment ID: <strong>{createdReference}</strong>
        </p>
      )}

      <AppointmentList
        appointments={data}
        loading={isLoading}
        onEdit={(item) => setEditingItem(item)}
        onDelete={deleteAppointment}
      />
    </section>
  );
};

export default AppointmentsPage;
