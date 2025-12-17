import { NextRequest, NextResponse } from 'next/server';
import { AgentCore } from '@/lib/agent/core';

// Ensure API key is present
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });
  }

  try {
    const { message, history } = await req.json();
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const agent = new AgentCore(GEMINI_API_KEY);
    
    // Create a ReadableStream to stream events back to client
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          for await (const event of agent.streamChat(message, history)) {
            // Send each event as a separate JSON line
            const line = JSON.stringify(event) + '\n';
            controller.enqueue(encoder.encode(line));
          }
        } catch (error: any) {
           const errorLine = JSON.stringify({ type: 'error', error: error.message }) + '\n';
           controller.enqueue(encoder.encode(errorLine));
        } finally {
          controller.close();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson', // Newline Delimited JSON
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
