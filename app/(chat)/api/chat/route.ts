import {
  type Message,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import * as pdfjsLib from 'pdfjs-dist';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { readFile as fsReadFile } from 'fs/promises';
import path from 'path';

import { auth } from '@/app/(auth)/auth';
import { myProvider } from '@/lib/ai/models';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from '@/lib/utils';

import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';

// Initialize PDF.js worker with a local worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

export const maxDuration = 60;

export async function POST(request: Request) {
  const {
    id,
    messages,
    selectedChatModel,
  }: { id: string; messages: Array<Message>; selectedChatModel: string } =
    await request.json();

  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userMessage = getMostRecentUserMessage(messages);

  if (!userMessage) {
    return new Response('No user message found', { status: 400 });
  }

  // Check if the message contains a file attachment
  const fileMatch = userMessage.content.match(/\[FILE: (.*?)\]/);
  if (fileMatch) {
    const filePath = fileMatch[1];
    console.log('Found file attachment:', filePath);
    
    try {
      // Read the file from the public/uploads directory
      const filePathFromRoot = path.join(process.cwd(), 'public', filePath);
      console.log('Attempting to read file from:', filePathFromRoot);
      
      const dataBuffer = await readFile(filePathFromRoot);
      console.log('File read successfully, buffer size:', dataBuffer.length);
      
      let data;
      try {
        console.log('Starting PDF parse...');
        // Convert Buffer to Uint8Array properly
        const uint8Array = new Uint8Array(dataBuffer.buffer);
        
        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const pdf = await loadingTask.promise;
        
        // Extract text from all pages
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + '\n';
        }
        
        data = {
          numpages: pdf.numPages,
          text: fullText
        };
        
        console.log('PDF parsed successfully:', {
          pages: data.numpages,
          textLength: data.text.length,
          firstPageText: data.text.substring(0, 100) // First 100 chars for debugging
        });
      } catch (parseError: any) {
        console.error('PDF Parse Error:', parseError);
        console.error('Error type:', parseError.constructor.name);
        console.error('Error message:', parseError.message);
        console.error('Error stack:', parseError.stack);
        throw parseError; // Re-throw to be caught by outer try-catch
      }
      
      // Create a new message with the PDF content
      const pdfMessage: Message = {
        id: generateUUID(),
        role: 'user',
        content: `Please analyze this invoice and extract the following information in JSON format:
        {
          "invoice_number": "",
          "date": "",
          "due_date": "",
          "total_amount": "",
          "vendor": {
            "name": "",
            "address": "",
            "tax_id": ""
          },
          "line_items": [
            {
              "description": "",
              "quantity": "",
              "unit_price": "",
              "amount": ""
            }
          ],
          "taxes": {
            "subtotal": "",
            "tax_rate": "",
            "tax_amount": "",
            "total": ""
          }
        }
        
        Here is the invoice content:
        ${data.text}`,
        createdAt: new Date(),
      };
      
      // Replace the original message with the PDF message
      messages[messages.length - 1] = pdfMessage;
      console.log('PDF message created and added to messages array');
    } catch (error) {
      console.error('Error processing PDF:', error);
      // Continue with the original message if PDF processing fails
    }
  }

  const chat = await getChatById({ id });

  if (!chat) {
    const title = await generateTitleFromUserMessage({ message: userMessage });
    await saveChat({ id, userId: session.user.id, title });
  }

  await saveMessages({
    messages: [{ ...userMessage, createdAt: new Date(), chatId: id }],
  });

  return createDataStreamResponse({
    execute: (dataStream) => {
      const result = streamText({
        model: myProvider.languageModel(selectedChatModel),
        system: systemPrompt({ selectedChatModel }),
        messages,
        maxSteps: 5,
        experimental_activeTools:
          selectedChatModel === 'chat-model-reasoning'
            ? []
            : [
                'getWeather',
                'createDocument',
                'updateDocument',
                'requestSuggestions',
              ],
        experimental_transform: smoothStream({ chunking: 'word' }),
        experimental_generateMessageId: generateUUID,
        tools: {
          getWeather,
          createDocument: createDocument({ session, dataStream }),
          updateDocument: updateDocument({ session, dataStream }),
          requestSuggestions: requestSuggestions({
            session,
            dataStream,
          }),
        },
        onFinish: async ({ response, reasoning }) => {
          if (session.user?.id) {
            try {
              const sanitizedResponseMessages = sanitizeResponseMessages({
                messages: response.messages,
                reasoning,
              });

              await saveMessages({
                messages: sanitizedResponseMessages.map((message) => {
                  return {
                    id: message.id,
                    chatId: id,
                    role: message.role,
                    content: message.content,
                    createdAt: new Date(),
                  };
                }),
              });
            } catch (error) {
              console.error('Failed to save chat');
            }
          }
        },
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'stream-text',
        },
      });

      result.mergeIntoDataStream(dataStream, {
        sendReasoning: true,
      });
    },
    onError: () => {
      return 'Oops, an error occured!';
    },
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
