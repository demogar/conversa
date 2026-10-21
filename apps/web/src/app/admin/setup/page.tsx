import { SetupWizard } from '@/features/admin/setup-wizard';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('admin.setup.title'));

export default function Page() {
  return <SetupWizard />;
}
