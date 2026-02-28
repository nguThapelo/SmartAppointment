import dayjs from 'dayjs';
import LoadingScreen from '@/components/General/LoadingScreen';

const badgeClassByStatus = {
  pending: 'app-surface-muted text-[var(--app-nav-link-text)]',
  confirmed: 'app-surface-muted text-[var(--app-nav-link-active-text)]',
  cancelled: 'app-surface-muted text-[var(--app-nav-link-text)]',
};

const AppointmentList = ({ appointments, onEdit, onDelete, loading }) => {
  if (loading) {
    return <LoadingScreen message="Loading appointments..." size="small" />;
  }

  if (!appointments?.length) {
    return <p className="text-sm text-slate-600">No appointments are available at this time.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {appointments.map((item) => (
        <article key={item.id} className="app-card-tight">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
            <span className={`rounded-full border px-2 py-1 text-xs font-medium ${badgeClassByStatus[item.status] || 'app-surface-muted text-[var(--app-nav-link-text)]'}`}>
              {item.status}
            </span>
          </div>

          {item.appointment_number && (
            <p className="mt-1 text-xs font-medium text-slate-500">ID: {item.appointment_number}</p>
          )}

          <p className="mt-2 text-sm text-slate-600">
            {dayjs(item.appointment_date || item.appointmentDate).format('ddd, MMM D YYYY h:mm A')}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {(item.service_category || 'General')} · {(item.service_subtype || 'General service')}
          </p>
          <p className="mt-1 text-sm text-slate-500">{item.notes || 'No additional notes provided.'}</p>

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => onEdit(item)} className="app-btn-secondary px-3 py-1.5">
              Edit details
            </button>
            <button type="button" onClick={() => onDelete(item.id)} className="app-btn-danger">
              Remove
            </button>
          </div>
        </article>
      ))}
    </div>
  );
};

export default AppointmentList;
