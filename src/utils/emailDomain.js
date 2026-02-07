const PUBLIC_EMAIL_PROVIDERS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'yandex.com',
  'yandex.ru',
  'gmx.com',
  'gmx.net',
  'mail.com',
  'fastmail.com',
  'hey.com',
  'tutanota.com',
  'tuta.com',
  'qq.com',
  'naver.com',
  'daum.net',
  '126.com',
  '163.com',
  'sina.com',
  'comcast.net',
  'verizon.net',
  'att.net',
  'btinternet.com',
  'bt.com',
  'mail.ru',
  'inbox.ru',
  'list.ru',
  'bk.ru',
]);

const INSTITUTIONAL_PATTERN = /\.(edu|ac|gov|mil|org)(\.|$)/i;

export const getEmailDomain = (email = '') => {
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) return '';
  return email.slice(atIndex + 1).trim().toLowerCase();
};

export const isInstitutionalEmailDomain = (email = '') => {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  if (PUBLIC_EMAIL_PROVIDERS.has(domain)) return false;
  if (INSTITUTIONAL_PATTERN.test(domain)) return true;

  return true;
};
