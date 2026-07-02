type RequestHandler = (req: any, res: any) => unknown;

let appPromise: Promise<RequestHandler> | null = null;
const builtAppModulePath = "../artifacts/api-server/dist/app.mjs" as string;

async function getApp(): Promise<RequestHandler> {
	if (!appPromise) {
		// Built during Vercel build command.
		appPromise = import(builtAppModulePath).then(
			(mod) => mod.default as RequestHandler,
		);
	}

	return appPromise;
}

export default async function handler(req: any, res: any): Promise<unknown> {
	const app = await getApp();
	return app(req, res);
}