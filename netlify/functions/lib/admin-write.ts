import { getUser, verifyRequestOrigin } from '@netlify/identity';

export async function authorizeAdminWrite(request: Request): Promise<Response | null> {
	const user = await getUser();
	if (!user) {
		return Response.json({ error: 'Bitte melde dich mit einem Admin-Konto an.' }, { status: 401 });
	}
	if (!user.roles?.includes('admin')) {
		return Response.json({ error: 'Für Änderungen ist die Netlify-Identity-Rolle „admin“ erforderlich.' }, { status: 403 });
	}
	try {
		verifyRequestOrigin(request);
	} catch {
		return Response.json({ error: 'Die Anfrage stammt nicht von dieser Website.' }, { status: 403 });
	}
	return null;
}
