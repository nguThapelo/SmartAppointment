import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '@/hooks/useAuth';
import { serviceCatalog } from '@/library/serviceCatalog';
import AppSelectField from '@/components/General/AppSelectField';
import LoadingButton from '@/components/General/LoadingButton';

const RegisterForm = () => {
  const router = useRouter();
  const { signUp } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');

  const validationSchema = yup.object({
      firstName: yup.string().required('First name is required'),
      lastName: yup.string().required('Last name is required'),
      phoneNumber: yup.string().required('Phone number is required'),
      email: yup.string().email('Invalid email format').required('Email is required'),
      role: yup.string().oneOf(['client', 'provider']).required('Role is required'),
      password: yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
      confirmPassword: yup.string()
        .oneOf([yup.ref('password'), null], 'Passwords must match')
        .required('Confirm Password is required')
    });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      email: '',
      role: 'client',
      serviceCategory: '',
      serviceSubService: '',
      password: '',
      confirmPassword: '',
    },
  });

  const selectedRole = watch('role');
  const selectedCategory = watch('serviceCategory');
  const selectedCategoryRecord = serviceCatalog.find((item) => item.name === selectedCategory);

  const onSubmit = async (values) => {
    setServerError('');
    const { error } = await signUp({
      email: values.email,
      password: values.password,
      metadata: {
        firstName: values.firstName,
        lastName: values.lastName,
        phoneNumber: values.phoneNumber,
        role: values.role,
        services:
          values.role === 'provider' && values.serviceCategory && values.serviceSubService
            ? [{ category: values.serviceCategory, subService: values.serviceSubService }]
            : [],
      },
    });

    if (error) {
      setServerError(error.message || 'Unable to register user');
      return;
    }

    router.push('/Appointments');
  };

  return (
    <section className="mx-auto mt-8 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Create account</h1>
      <p className="mt-1 text-sm text-slate-600">Register to manage appointments in real time.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="app-label">First name</label>
          <input {...register('firstName')} className="app-input" />
          {errors.firstName?.message && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
        </div>
        <div>
          <label className="app-label">Last name</label>
          <input {...register('lastName')} className="app-input" />
          {errors.lastName?.message && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="app-label">Phone number</label>
          <input {...register('phoneNumber')} className="app-input" />
          {errors.phoneNumber?.message && <p className="mt-1 text-xs text-red-600">{errors.phoneNumber.message}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="app-label">Email address</label>
          <input type="email" {...register('email')} className="app-input" />
          {errors.email?.message && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <AppSelectField
                label="Account role"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'client', label: 'Client' },
                  { value: 'provider', label: 'Service provider' },
                ]}
                placeholder="Select account role"
              />
            )}
          />
          {errors.role?.message && <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>}
        </div>

        {selectedRole === 'provider' && (
          <>
            <div className="sm:col-span-2">
              <Controller
                name="serviceCategory"
                control={control}
                render={({ field }) => (
                  <AppSelectField
                    label="Primary service category"
                    value={field.value}
                    onChange={field.onChange}
                    options={serviceCatalog.map((item) => ({ value: item.name, label: item.name }))}
                    placeholder="Select a category"
                  />
                )}
              />
            </div>

            <div className="sm:col-span-2">
              <Controller
                name="serviceSubService"
                control={control}
                render={({ field }) => (
                  <AppSelectField
                    label="Primary service sub-category"
                    value={field.value}
                    onChange={field.onChange}
                    options={(selectedCategoryRecord?.subServices || []).map((item) => ({ value: item, label: item }))}
                    placeholder="Select a sub-category"
                  />
                )}
              />
            </div>
          </>
        )}
        <div className="sm:col-span-2">
          <label className="app-label">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              className="app-input pr-10"
            />
            <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 right-0 px-3 text-xs text-slate-600">
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.password?.message && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="app-label">Confirm password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            {...register('confirmPassword')}
            className="app-input"
          />
          {errors.confirmPassword?.message && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
        </div>

        {serverError && <p className="sm:col-span-2 text-sm text-red-600">{serverError}</p>}

        <LoadingButton
          type="submit"
          loading={isSubmitting}
          loadingText="Creating account..."
          className="app-btn-primary sm:col-span-2"
        >
          Create account
        </LoadingButton>
      </form>

      <p className="mt-4 text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/Login" className="font-medium text-slate-900 underline">
          Sign in
        </Link>
      </p>
    </section>
  )
}

export default RegisterForm