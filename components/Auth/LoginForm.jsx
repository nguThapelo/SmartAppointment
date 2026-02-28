import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '@/hooks/useAuth';
import LoadingButton from '@/components/General/LoadingButton';

const LoginForm = () => {
  const router = useRouter();
  const { signIn, resetPassword } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [resetStatus, setResetStatus] = useState('');

  const validationSchema = yup.object({
    email: yup.string().email('Invalid email format').required('Email is required'),
    password: yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  });

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values) => {
    setServerError('');
    setResetStatus('');
    const { error } = await signIn(values);
    if (error) {
      setServerError(error.message || 'Unable to sign in');
      return;
    }
    router.push('/Appointments');
  };

  const onForgotPassword = async () => {
    setResetStatus('');
    const emailValue = getValues('email');
    if (!emailValue) {
      setResetStatus('Please enter your email address first, then select Reset password.');
      return;
    }

    try {
      await resetPassword(emailValue);
      setResetStatus('A password reset email has been sent. Please check your inbox.');
    } catch (_error) {
      setResetStatus('Unable to send the password reset email. Please try again.');
    }
  };

  return (
    <section className="mx-auto mt-12 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-slate-600">Access your account securely.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            id="email"
            type="email"
            {...register('email')}
            className="app-input"
          />
          {errors.email?.message && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              className="app-input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 right-0 px-3 text-xs text-slate-600"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.password?.message && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        {serverError && <p className="text-sm text-red-600">{serverError}</p>}

        <LoadingButton
          type="submit"
          loading={isSubmitting}
          loadingText="Signing in..."
          className="app-btn-primary w-full"
        >
          Sign in
        </LoadingButton>

        <button
          type="button"
          onClick={onForgotPassword}
          className="app-btn-secondary w-full"
        >
          Reset password
        </button>
      </form>

      {resetStatus && <p className="mt-2 text-sm text-slate-600">{resetStatus}</p>}

      <p className="mt-4 text-sm text-slate-600">
        Need an account?{' '}
        <Link href="/Register" className="font-medium text-slate-900 underline">
          Register
        </Link>
      </p>
    </section>
  )
}

export default LoginForm