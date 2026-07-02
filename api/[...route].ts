type RequestHandler = (req: any, res: any) => unknown;

let appPromise: Promise<RequestHandler> | null = null;

async function getApp(): Promise<RequestHandler> {
	if (!appPromise) {
		// Built during Vercel build command.
		appPromise = import("../artifacts/api-server/dist/app.mjs").then(
			(mod) => mod.default as RequestHandler,
		);
	}

	return appPromise;
}

export default async function handler(req: any, res: any): Promise<unknown> {
	const app = await getApp();
	return app(req, res);
}