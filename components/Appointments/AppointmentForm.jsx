import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import dayjs from 'dayjs';
import AppSelectField from '@/components/General/AppSelectField';
import LoadingButton from '@/components/General/LoadingButton';

const schema = yup.object({
  title: yup.string().required('Title is required'),
  serviceCategory: yup.string().required('Service category is required'),
  serviceSubService: yup.string().required('Sub-service is required'),
  providerId: yup.string().required('Provider is required'),
  notes: yup.string().max(500, 'Notes cannot be longer than 500 characters'),
  appointmentDate: yup
    .string()
    .required('Appointment date and time are required')
    .test('is-valid-date', 'Please provide a valid date and time', (value) => dayjs(value).isValid()),
  status: yup.string().oneOf(['pending', 'confirmed', 'cancelled']).required(),
});

const AppointmentForm = ({
  initialValues,
  onSubmit,
  onCancel,
  isSaving,
  services,
  providers,
  role,
}) => {
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const selectedCategory = watch('serviceCategory');
  const selectedCategoryObject = (services || []).find((item) => item.name === selectedCategory);
  const selectedSubServices = selectedCategoryObject?.subServices || [];
  const selectedSubService = watch('serviceSubService');

  const filteredProviders = (providers || []).filter((provider) => {
    if (!selectedCategory) {
      return true;
    }

    const offered = provider.services || [];
    return offered.some((service) => {
      const categoryMatch = service?.category === selectedCategory;
      const subServiceMatch = selectedSubService ? service?.subService === selectedSubService : true;
      return categoryMatch && subServiceMatch;
    });
  });

  const canSetStatus = role === 'provider' || role === 'admin';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="app-card app-form-grid grid gap-4">
      <div>
        <label className="app-label">Appointment title</label>
        <input {...register('title')} className="app-input" />
        {errors.title?.message && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
      </div>

      <div>
        <Controller
          name="serviceCategory"
          control={control}
          render={({ field }) => (
            <AppSelectField
              label="Service category"
              value={field.value}
              onChange={field.onChange}
              options={(services || []).map((item) => ({ value: item.name, label: item.name }))}
              placeholder="Select a category"
            />
          )}
        />
        {errors.serviceCategory?.message && <p className="mt-1 text-xs text-red-600">{errors.serviceCategory.message}</p>}
      </div>

      <div>
        <Controller
          name="serviceSubService"
          control={control}
          render={({ field }) => (
            <AppSelectField
              label="Service sub-category"
              value={field.value}
              onChange={field.onChange}
              options={selectedSubServices.map((item) => ({ value: item, label: item }))}
              placeholder="Select a sub-category"
            />
          )}
        />
        {errors.serviceSubService?.message && <p className="mt-1 text-xs text-red-600">{errors.serviceSubService.message}</p>}
      </div>

      <div>
        <Controller
          name="providerId"
          control={control}
          render={({ field }) => (
            <AppSelectField
              label="Service provider"
              value={field.value}
              onChange={field.onChange}
              options={filteredProviders.map((provider) => ({
                value: provider.id,
                label: provider.firstName || provider.lastName
                  ? `${provider.firstName || ''} ${provider.lastName || ''}`.trim()
                  : provider.email,
              }))}
              placeholder="Select provider"
            />
          )}
        />
        {errors.providerId?.message && <p className="mt-1 text-xs text-red-600">{errors.providerId.message}</p>}
      </div>

      <div>
        <label className="app-label">Appointment date and time</label>
        <input type="datetime-local" {...register('appointmentDate')} className="app-input" />
        {errors.appointmentDate?.message && <p className="mt-1 text-xs text-red-600">{errors.appointmentDate.message}</p>}
      </div>

      <div>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <AppSelectField
              label="Appointment status"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'confirmed', label: 'Confirmed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              placeholder="Select status"
              disabled={!canSetStatus}
            />
          )}
        />
      </div>

      <div>
        <label className="app-label">Additional notes</label>
        <textarea rows={3} {...register('notes')} className="app-textarea" />
        {errors.notes?.message && <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p>}
      </div>

      <div className="app-form-grid grid gap-2 sm:grid-cols-2">
        <LoadingButton
          type="submit"
          loading={isSaving}
          loadingText="Saving..."
          className="app-btn-primary"
        >
          Save appointment
        </LoadingButton>
        <button type="button" onClick={onCancel} className="app-btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
};

export default AppointmentForm;
