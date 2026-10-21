import { AccountPage } from '@/features/account/account-page';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('account.title'));

export default function Page() {
  return <AccountPage />;
}
