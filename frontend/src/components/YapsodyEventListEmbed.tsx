import { useEffect } from 'react';

const YAPSODY_EVENT_LIST_SCRIPT = 'https://images.yapsody.com/widgets/event-list.js';
const SCRIPT_ID = 'yapsody-event-list-widget';

type Props = {
  eventId: string;
  venueCode: string;
  className?: string;
};

/** Yapsody embedded event list (Tickets section on Durga Puja and similar pages). */
export default function YapsodyEventListEmbed({ eventId, venueCode, className = '' }: Props) {
  const widgetId = `yapwid-event-${eventId}`;

  useEffect(() => {
    if (!eventId.trim() || !venueCode.trim()) return;

    const mountScript = () => {
      document.getElementById(SCRIPT_ID)?.remove();
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = YAPSODY_EVENT_LIST_SCRIPT;
      script.defer = true;
      document.body.appendChild(script);
    };

    mountScript();
  }, [eventId, venueCode]);

  if (!eventId.trim() || !venueCode.trim()) return null;

  return (
    <div
      className={`yapsody-event-list-embed min-h-[8rem] ${className}`.trim()}
      id={widgetId}
      data-venue-code={venueCode}
    />
  );
}
