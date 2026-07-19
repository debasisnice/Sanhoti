import { useEffect } from 'react';

const STRIPE_BUY_BUTTON_SCRIPT = 'https://js.stripe.com/v3/buy-button.js';
const SCRIPT_ID = 'stripe-buy-button-js';

type Props = {
  buyButtonId: string;
  publishableKey: string;
  className?: string;
};

/** Stripe hosted buy button for the Donate page. */
export default function StripeBuyButtonEmbed({ buyButtonId, publishableKey, className = '' }: Props) {
  useEffect(() => {
    if (!buyButtonId.trim() || !publishableKey.trim()) return;

    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = STRIPE_BUY_BUTTON_SCRIPT;
    script.async = true;
    document.body.appendChild(script);
  }, [buyButtonId, publishableKey]);

  if (!buyButtonId.trim() || !publishableKey.trim()) return null;

  return (
    <div className={`stripe-buy-button-embed flex justify-center ${className}`.trim()}>
      <stripe-buy-button buy-button-id={buyButtonId} publishable-key={publishableKey} />
    </div>
  );
}
