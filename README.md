# Project 9: L'Oréal Routine Builder
L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder. 

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Cloudflare Worker web search

Copy the contents of `cloudflare-worker.js` into the Cloudflare Worker dashboard.
Create a Worker secret named `OPENAI_API_KEY`. Do not put the key in this repository.

The worker uses OpenAI's `gpt-5-search-api` model for real-time web search and returns URL citations in the chat response.