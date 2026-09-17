import { useState } from 'react';
import { authFetch } from '../api/client';

export function usePayments({ token, user, setUser, onRequireAuth, onUpgraded }) {
  // Payment simulator modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activePaymentOrder, setActivePaymentOrder] = useState(null);

  // Payments: Create Razorpay Order
  const handleUpgradeClick = async (plan) => {
    if (!user) {
      onRequireAuth?.('register');
      return;
    }

    try {
      const res = await authFetch('/payments/create-order', { token, method: 'POST', body: { plan } });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Failed to initiate order.');
        return;
      }

      if (data.simulated) {
        // Open Simulated checkout Modal
        setActivePaymentOrder(data);
        setShowPaymentModal(true);
      } else {
        // Open Real Razorpay Standard Checkout
        const options = {
          key: data.keyId,
          amount: data.amount,
          currency: 'INR',
          name: 'Scoutify',
          description: `${plan.toUpperCase()} Membership Upgrade`,
          order_id: data.orderId,
          handler: async function (response) {
            // Verify payment
            const verifyRes = await authFetch('/payments/verify-payment', {
              token,
              method: 'POST',
              body: {
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
                plan,
                simulated: false
              }
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok) {
              setUser(verifyData.user);
              alert('Payment verified! Your account is now upgraded to ' + plan.toUpperCase() + '.');
              onUpgraded?.();
            } else {
              alert(verifyData.message || 'Verification failed.');
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
      alert('Error connecting to payment processor.');
    }
  };

  // Payments: Complete Simulated payment
  const completeSimulatedPayment = async (success) => {
    if (!success) {
      alert('Payment failed/cancelled.');
      setShowPaymentModal(false);
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
          simulated: true
        }
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        alert('Simulated payment successful! Upgraded to ' + activePaymentOrder.plan.toUpperCase());
        setShowPaymentModal(false);
        onUpgraded?.();
      } else {
        alert(data.message || 'Payment upgrade verification failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating subscription.');
    }
  };

  return {
    showPaymentModal,
    activePaymentOrder,
    handleUpgradeClick,
    completeSimulatedPayment
  };
}

export default usePayments;
