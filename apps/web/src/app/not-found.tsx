import { NotFoundScreen } from '@/features/errors/status-screens';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('common.notFound.heading'));

export default function NotFound() {
  return <NotFoundScreen />;
}
