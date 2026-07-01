import type { APIRoute } from 'astro';
import { getModelList } from '../lib/models';

export const GET: APIRoute = async () => {
  const models = await getModelList();
  return new Response(JSON.stringify(models, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
