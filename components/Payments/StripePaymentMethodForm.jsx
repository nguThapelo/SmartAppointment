import { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { usePayments } from '@/hooks/usePayments';
import { useAuth } from '@/hooks/useAuth';

const cardElementOptions = {
  style: {
    base: {
      fontSize: '14px',
      color: '#0f172a',
      '::placeholder': {
        color: '#94a3b8',
      },
    },
    invalid: {
      color: '#dc2626',
    },
  },
};

const StripeCardInner = ({ onSaved }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const { createSetupIntent, addPaymentMethod, isSaving } = usePayments();
  const [clientSecret, setClientSecret] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    const bootstrapSetupIntent = async () => {
      try {
        const result = await createSetupIntent({ email: user?.email });
        if (mounted) {
          setClientSecret(result?.clientSecret || '');
        }
      } catch (error) {
        if (mounted) {
          setErrorMessage(error?.response?.data?.error || 'Failed to initialize Stripe setup.');
        }
      }
    };

    bootstrapSetupIntent();

    return () => {
      mounted = false;
    };
  }, [createSetupIntent, user?.email]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');

    if (!stripe || !elements || !clientSecret) {
      setErrorMessage('Stripe is not ready yet.');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setErrorMessage('Card input is not ready.');
      return;
    }

    const confirmResult = await stripe.confirmCardSetup(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          email: user?.email || undefined,
        },
      },
    });

    if (confirmResult.error) {
      setErrorMessage(confirmResult.error.message || 'Failed to save payment method.');
      return;
    }

    const paymentMethodId = confirmResult.setupIntent?.payment_method;
    if (!paymentMethodId) {
      setErrorMessage('Stripe did not return a payment method id.');
      return;
    }

    try {
      await addPaymentMethod({ paymentMethodId, isDefault: true, email: user?.email });
      if (onSaved) {
        onSaved();
      }
    } catch (error) {
      setErrorMessage(error?.response?.data?.error || 'Failed to save payment method in app database.');
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-slate-200 p-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Card details</label>
        <div className="rounded-md border border-slate-300 px-3 py-2">
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      {errorMessage && <p className="text-xs text-rose-600">{errorMessage}</p>}

      <button
        type="submit"
        disabled={isSaving || !stripe || !clientSecret}
        className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSaving ? 'Saving card...' : 'Save card as default'}
      </button>
    </form>
  );
};

const StripePaymentMethodForm = ({ onSaved }) => {
  const stripePromise = useMemo(() => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      return null;
    }

    return loadStripe(publishableKey);
  }, []);

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <p className="text-xs text-rose-600">
        error missing info
      </p>
    );
  }

  if (!stripePromise) {
    return <p className="text-xs text-slate-500">Loading Stripe...</p>;
  }

  return (
    <Elements stripe={stripePromise}>
      <StripeCardInner onSaved={onSaved} />
    </Elements>
  );
};

export default StripePaymentMethodForm;
