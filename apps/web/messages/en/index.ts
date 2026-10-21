// One JSON file per area of the app, merged into one message tree.
import common from './common.json';
import errors from './errors.json';
import auth from './auth.json';
import nav from './nav.json';
import dashboard from './dashboard.json';
import automations from './automations.json';
import channels from './channels.json';
import inbox from './inbox.json';
import contacts from './contacts.json';
import activity from './activity.json';
import content from './content.json';
import settings from './settings.json';
import integrations from './integrations.json';
import account from './account.json';
import legal from './legal.json';

const messages = {
  common,
  errors,
  auth,
  nav,
  dashboard,
  automations,
  channels,
  inbox,
  contacts,
  activity,
  content,
  settings,
  integrations,
  account,
  legal,
};

export default messages;
