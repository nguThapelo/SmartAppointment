import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import Chip from '@mui/material/Chip';
import { useQuery } from '@tanstack/react-query';
import AppSelectField from '@/components/General/AppSelectField';
import { useAuth } from '@/hooks/useAuth';
import { apiInstance } from '@/library/apiClient';

const schema = yup.object({
  password: yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password'), null], 'Passwords must match')
    .required('Confirm password is required'),
});

const Profile = () => {
  const { user, role, updatePassword, updateProfile } = useAuth();
  const [feedback, setFeedback] = useState('');
  const [profileFeedback, setProfileFeedback] = useState('');
  const [firstName, setFirstName] = useState(user?.user_metadata?.firstName || '');
  const [lastName, setLastName] = useState(user?.user_metadata?.lastName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.user_metadata?.phoneNumber || '');
  const [providerServiceCategory, setProviderServiceCategory] = useState('');
  const [providerServiceSubCategory, setProviderServiceSubCategory] = useState('');
  const [providerServices, setProviderServices] = useState(user?.user_metadata?.services || []);

  const { data: serviceCategories = [] } = useQuery({
    queryKey: ['service-categories-profile'],
    queryFn: async () => {
      const response = await apiInstance.get('/api/services');
      return response.data || [];
    },
    enabled: role === 'provider',
  });

  const selectedProviderCategory = useMemo(
    () => serviceCategories.find((item) => item.name === providerServiceCategory),
    [serviceCategories, providerServiceCategory]
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async ({ password }) => {
    setFeedback('');
    const { error } = await updatePassword(password);
    if (error) {
      setFeedback(error.message || 'Unable to update password');
      return;
    }
    setFeedback('Password updated successfully.');
    reset();
  };

  const addProviderService = () => {
    if (!providerServiceCategory || !providerServiceSubCategory) {
      return;
    }

    const exists = providerServices.some(
      (item) =>
        item.category === providerServiceCategory && item.subService === providerServiceSubCategory
    );

    if (exists) {
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

  const onProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileFeedback('');

    const metadata = {
      ...(user?.user_metadata || {}),
      firstName,
      lastName,
      phoneNumber,
    };

    if (role === 'provider') {
      metadata.services = providerServices;
    }

    const { error } = await updateProfile(metadata);
    if (error) {
      setProfileFeedback(error.message || 'Unable to update profile details.');
      return;
    }

    setProfileFeedback('Profile details updated successfully.');
  };

  return (
    <section className="mx-auto max-w-xl space-y-4 app-card">
      <h1 className="text-2xl font-semibold text-slate-900">Profile & Security</h1>
      <p className="text-sm text-slate-600">Signed in as: {user?.email || 'Not available'}</p>

      <form onSubmit={onProfileSubmit} className="space-y-4 app-card-tight">
        <h2 className="text-lg font-semibold text-slate-900">Personal information</h2>
        <div>
          <label className="app-label">First name</label>
          <input value={firstName} onChange={(event) => setFirstName(event.target.value)} className="app-input" />
        </div>
        <div>
          <label className="app-label">Last name</label>
          <input value={lastName} onChange={(event) => setLastName(event.target.value)} className="app-input" />
        </div>
        <div>
          <label className="app-label">Phone number</label>
          <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} className="app-input" />
        </div>

        {role === 'provider' && (
          <>
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
            <button type="button" className="app-btn-secondary" onClick={addProviderService}>
              Add provider service
            </button>
            <div className="flex flex-wrap gap-2">
              {providerServices.length === 0 && (
                <p className="text-xs text-slate-500">No services added yet.</p>
              )}
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
          </>
        )}

        {profileFeedback && (
          <p className={`text-sm ${profileFeedback.includes('successfully') ? 'text-emerald-700' : 'text-red-600'}`}>
            {profileFeedback}
          </p>
        )}

        <button type="submit" className="app-btn-primary">Update profile details</button>
      </form>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Security</h2>
        <div>
          <label className="app-label">New password</label>
          <input type="password" {...register('password')} className="app-input" />
          {errors.password?.message && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <div>
          <label className="app-label">Confirm new password</label>
          <input type="password" {...register('confirmPassword')} className="app-input" />
          {errors.confirmPassword?.message && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
        </div>

        {feedback && (
          <p className={`text-sm ${feedback.includes('successfully') ? 'text-emerald-700' : 'text-red-600'}`}>
            {feedback}
          </p>
        )}

        <button type="submit" disabled={isSubmitting} className="app-btn-primary">
          {isSubmitting ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </section>
  );
};

export default Profile;
