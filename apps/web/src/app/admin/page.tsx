import { AdminPage } from '@/features/admin/admin-page';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('admin.title'));

export default function Page() {
  return <AdminPage />;
}
