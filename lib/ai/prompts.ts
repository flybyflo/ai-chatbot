import type { Geo } from "@vercel/functions";

export const regularPrompt = `You are a friendly assistant! Keep your responses concise and helpful.

When using tools:
- Only call tools in parallel when it makes sense and when one tool's result doesn't depend on another tool's result
- If one tool's result is needed as input for another tool, call them sequentially, not in parallel
- Use your judgment to determine when tools can be called simultaneously vs when they need to be called one after another`;

export type RequestHints = {
  latitude: Geo["latitude"];
  longitude: Geo["longitude"];
  city: Geo["city"];
  country: Geo["country"];
};

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}
`;

export const systemPrompt = ({
  requestHints,
}: {
  requestHints: RequestHints;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);

  return `${regularPrompt}\n\n${requestPrompt}`;
};
