import { useState } from 'react';
import { authFetch } from '../api/client';
import { emptyReauth } from '../components/auth/ReauthFields.jsx';
import { showAlert } from '../components/ui/dialog';

export function usePayments({ token, user, setUser, onRequireAuth, onUpgraded, requestReauthEmailCode }) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activePaymentOrder, setActivePaymentOrder] = useState(null);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [reauthForm, setReauthForm] = useState(emptyReauth());
  const [reauthError, setReauthError] = useState('');
  const [reauthBusy, setReauthBusy] = useState(false);
  const [emailCodeBusy, setEmailCodeBusy] = useState(false);
  const [verifiedReauth, setVerifiedReauth] = useState(null);

  const handleUpgradeClick = async (plan) => {
    if (!user) {
      onRequireAuth?.('register');
      return;
    }
    setPendingPlan(plan);
    setReauthForm(emptyReauth());
    setReauthError('');
    setShowReauthModal(true);
  };

  const sendEmailCode = async () => {
    setEmailCodeBusy(true);
    setReauthError('');
    try {
      if (requestReauthEmailCode) {
        await requestReauthEmailCode();
        showAlert('If a re-auth code is needed, check your email (or the backend console in development).', { title: 'Check your email' });
      }
    } catch (err) {
      setReauthError('Could not send re-auth code.');
    } finally {
      setEmailCodeBusy(false);
    }
  };

  const confirmReauthAndStartOrder = async (e) => {
    e.preventDefault();
    if (!pendingPlan) return;
    setReauthBusy(true);
    setReauthError('');
    try {
      const res = await authFetch('/payments/create-order', {
        token,
        method: 'POST',
        body: { plan: pendingPlan, ...reauthForm }
      });
      const data = await res.json();
      if (!res.ok) {
        setReauthError(data.message || 'Failed to initiate order.');
        return;
      }

      const credentials = { ...reauthForm };
      setVerifiedReauth(credentials);
      setShowReauthModal(false);
      setReauthForm(emptyReauth());

      if (data.simulated) {
        setActivePaymentOrder(data);
        setShowPaymentModal(true);
      } else {
        const options = {
          key: data.keyId,
          amount: data.amount,
          currency: 'INR',
          name: 'Scoutify',
          description: `${pendingPlan.toUpperCase()} Membership Upgrade`,
          order_id: data.orderId,
          handler: async function (response) {
            const verifyRes = await authFetch('/payments/verify-payment', {
              token,
              method: 'POST',
              body: {
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
                plan: pendingPlan,
                simulated: false,
                ...credentials
              }
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok) {
              setUser(verifyData.user);
              showAlert('Your account is now upgraded to ' + pendingPlan.toUpperCase() + '.', { title: 'Payment verified', tone: 'success' });
              onUpgraded?.();
            } else {
              showAlert(verifyData.message || 'Verification failed.', { tone: 'error' });
            }
          },
          prefill: {
            name: user.name,
            email: user.email
          },
          theme: {
            color: '#14f195'
          }
        };

        const rzp1 = new window.Razorpay(options);
        rzp1.open();
      }
    } catch (err) {
      console.error(err);
      setReauthError('Error connecting to payment processor.');
    } finally {
      setReauthBusy(false);
    }
  };

  const completeSimulatedPayment = async (success) => {
    if (!success) {
      showAlert('The payment was not completed.', { title: 'Payment cancelled', tone: 'error' });
      setShowPaymentModal(false);
      setVerifiedReauth(null);
      return;
    }

    try {
      const res = await authFetch('/payments/verify-payment', {
        token,
        method: 'POST',
        body: {
          paymentId: `pay_sim_${Math.random().toString(36).substr(2, 9)}`,
          orderId: activePaymentOrder.orderId,
          plan: activePaymentOrder.plan,
          simulated: true,
          ...(verifiedReauth || {})
        }
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        showAlert('Upgraded to ' + activePaymentOrder.plan.toUpperCase() + '.', { title: 'Simulated payment successful', tone: 'success' });
        setShowPaymentModal(false);
        setVerifiedReauth(null);
        onUpgraded?.();
      } else {
        showAlert(data.message || 'Payment upgrade verification failed.', { tone: 'error' });
      }
    } catch (err) {
      console.error(err);
      showAlert('Error updating subscription.', { tone: 'error' });
    }
  };

  const closeReauthModal = () => {
    setShowReauthModal(false);
    setPendingPlan(null);
    setReauthError('');
    setReauthForm(emptyReauth());
  };

  return {
    showPaymentModal,
    activePaymentOrder,
    showReauthModal,
    pendingPlan,
    reauthForm,
    setReauthForm,
    reauthError,
    reauthBusy,
    emailCodeBusy,
    handleUpgradeClick,
    completeSimulatedPayment,
    confirmReauthAndStartOrder,
    closeReauthModal,
    sendEmailCode
  };
}

export default usePayments;
