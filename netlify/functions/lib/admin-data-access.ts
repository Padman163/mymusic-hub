import type { Context } from '@netlify/functions';

export function canManageOnlineData(context: Context): boolean {
	const deploy = context.deploy;
	return process.env.NETLIFY_DEV !== 'true' && (deploy?.context === 'deploy-preview' ||
		(deploy?.context === 'production' && deploy.published));
}
