import { QueryClient, MutationCache } from '@tanstack/react-query';
import { showRequestError } from '@/lib/globalErrors';

export const queryClientInstance = new QueryClient({
	// A mutation without its own onError used to fail silently; show the
	// server's message instead. Mutations that handle errors keep doing so.
	mutationCache: new MutationCache({
		onError: (error, _vars, _ctx, mutation) => {
			if (!mutation.options.onError) showRequestError(error);
		},
	}),
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});
