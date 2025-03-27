import { auth } from '@/app/(auth)/auth';
import { getSuggestionsByDocumentId, getDocumentsById } from '@/lib/db/queries';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');

  if (!documentId) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  // First check if the user has access to the document
  const documents = await getDocumentsById({ id: documentId });
  const [document] = documents;

  if (!document) {
    return new Response('Document not found', { status: 404 });
  }

  if (document.userId !== session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  // If user has access to document, get the suggestions
  const suggestions = await getSuggestionsByDocumentId({
    documentId,
  });

  return Response.json(suggestions, { status: 200 });
}
