import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Feed-style card for notices, news, and similar dated announcements.
 * Matches the clean white card style used on /artists and /charity.
 */
export default function FeedItemCard({
  icon: Icon,
  title,
  date,
  badges,
  children,
  variant = 'default',
  index = 0,
}: {
  icon: LucideIcon;
  title: string;
  date?: string;
  badges?: React.ReactNode;
  children: React.ReactNode;
  variant?: 'default' | 'muted';
  index?: number;
}) {
  const cardClass =
    variant === 'muted'
      ? 'bg-gray-50 rounded-2xl shadow-md border border-gray-200'
      : 'bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow';

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={cardClass}
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div
            className="shrink-0 w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center"
            aria-hidden
          >
            <Icon className="w-5 h-5 text-primary-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
              <div className="min-w-0">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h3>
                {badges ? <div className="flex flex-wrap gap-2 mt-2">{badges}</div> : null}
              </div>
              {date ? (
                <time className="text-sm text-gray-500 shrink-0 sm:text-right whitespace-nowrap">
                  Posted {date}
                </time>
              ) : null}
            </div>
            {children}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
