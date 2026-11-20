/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineButton = document.getElementById("generateRoutine");
const userInput = document.getElementById("userInput");
const productDialog = document.getElementById("productDialog");
const closeProductDialog = document.getElementById("closeProductDialog");
const dialogTitle = document.getElementById("dialogTitle");
const dialogBrand = document.getElementById("dialogBrand");
const dialogDescription = document.getElementById("dialogDescription");
const clearSelectedProducts = document.getElementById("clearSelectedProducts");
const productSearch = document.getElementById("productSearch");
const toggleProducts = document.getElementById("toggleProducts");
const goToChat = document.getElementById("goToChat");
const chatbox = document.querySelector(".chatbox");
let openDetailsId = null;
const savedProductsKey = "loreal-selected-products";

/* Cloudflare Worker URL — the worker safely holds the API key */
const workerUrl = "https://mute-forest-8bc8.aapolo.workers.dev/";

/* Keep every message so the AI can remember the conversation */
const messages = [
  {
    role: "system",
    content:
      "You are a L'Oréal skincare and beauty advisor. Answer only questions about the generated routine or related topics such as L'Oréal products, skincare, haircare, makeup, fragrance, ingredients, and beauty routines. Use the full conversation history to keep answers relevant and remember names or preferences the user shares. If a question is unrelated or way off topic, briefly acknowledge the topic from the user's question, politely explain that you cannot help with it, and warmly redirect them to L'Oréal products or beauty routines. Keep your response friendly and conversational. Use current real-time web information when the question asks about new products, prices, availability, ingredients, recalls, or other current facts. Include and cite reliable source links. Format answers with short section titles and simple numbered steps. Do not use Markdown symbols, hashtags, asterisks, or tables.",
  },
];

/* Keep track of products selected by the user */
let selectedProducts = [];
let allProducts = [];
let productsAreHidden = false;

/* Save selected product IDs so selections survive a page reload */
function saveSelectedProducts() {
  const selectedIds = selectedProducts.map((product) => product.id);
  localStorage.setItem(savedProductsKey, JSON.stringify(selectedIds));
}

/* Restore selected products from the full product JSON file */
async function restoreSelectedProducts() {
  let savedIds = [];

  try {
    savedIds = JSON.parse(localStorage.getItem(savedProductsKey) || "[]");
  } catch (error) {
    localStorage.removeItem(savedProductsKey);
  }

  if (savedIds.length === 0) {
    displaySelectedProducts();
    return;
  }

  allProducts = await loadProducts();
  selectedProducts = allProducts.filter((product) =>
    savedIds.includes(product.id)
  );
  displaySelectedProducts();

  if (categoryFilter.value) {
    displayProducts(
      allProducts.filter((product) => product.category === categoryFilter.value)
    );
  }
}

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Apply both category and keyword filters to the product grid */
function normalizeSearchText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* Count small spelling differences between two words */
function isCloseSpelling(word, target) {
  if (word.length < 3 || target.length < 3) return word === target;

  if (target.includes(word) || word.includes(target)) return true;

  let previousRow = Array.from(
    { length: target.length + 1 },
    (_, index) => index
  );

  for (let wordIndex = 1; wordIndex <= word.length; wordIndex++) {
    const currentRow = [wordIndex];

    for (let targetIndex = 1; targetIndex <= target.length; targetIndex++) {
      const insertCost = currentRow[targetIndex - 1] + 1;
      const deleteCost = previousRow[targetIndex] + 1;
      const replaceCost =
        previousRow[targetIndex - 1] +
        (word[wordIndex - 1] === target[targetIndex - 1] ? 0 : 1);

      currentRow[targetIndex] = Math.min(
        insertCost,
        deleteCost,
        replaceCost
      );
    }

    previousRow = currentRow;
  }

  const distance = previousRow[target.length];
  return distance <= (target.length <= 5 ? 1 : 2);
}

function filterProducts() {
  if (allProducts.length === 0) return;

  const selectedCategory = categoryFilter.value;
  const searchText = normalizeSearchText(productSearch.value);
  const searchWords = searchText.match(/[a-z0-9]+/g) || [];

  const matchingProducts = allProducts.filter((product) => {
    let matchesCategory = true;

    if (selectedCategory !== "all") {
      matchesCategory = product.category === selectedCategory;
    }

    const searchableText = normalizeSearchText(
      `${product.name} ${product.brand} ${product.category} ${product.description}`
    );
    const searchableWords = searchableText.match(/[a-z0-9]+/g) || [];

    let matchesSearch = searchText === "";
    if (!matchesSearch) {
      matchesSearch =
        searchableText.includes(searchText) ||
        searchWords.some((searchWord) =>
          searchableWords.some((productWord) =>
            isCloseSpelling(searchWord, productWord)
          )
        );
    }

    return matchesCategory && matchesSearch;
  });

  if (matchingProducts.length === 0) {
    productsContainer.innerHTML =
      '<div class="placeholder-message">No matching products found</div>';
    return;
  }

  displayProducts(matchingProducts);
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card ${selectedProducts.some((item) => item.id === product.id) ? "selected" : ""}"
         data-product-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <button type="button" class="details-btn" data-details-id="${product.id}">
          View Description
        </button>
      </div>
    </div>
  `
    )
    .join("");
}

/* Show the products the user has selected */
function displaySelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = "<p>No products selected yet.</p>";
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
      <div class="selected-product">
        ${product.brand} - ${product.name}
        <button type="button" data-remove-id="${product.id}" aria-label="Remove ${product.name}">
          &times;
        </button>
      </div>
    `
    )
    .join("");
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  allProducts = await loadProducts();
  filterProducts();
});

/* Filter as soon as the user types in the search field */
productSearch.addEventListener("input", async () => {
  if (allProducts.length === 0) {
    allProducts = await loadProducts();
  }
  filterProducts();
});

/* Hide or show the product grid without changing filters or selections */
toggleProducts.addEventListener("click", () => {
  productsAreHidden = !productsAreHidden;
  productsContainer.classList.toggle("products-grid-hidden", productsAreHidden);
  toggleProducts.textContent = productsAreHidden
    ? "Show Products"
    : "Hide Products";
  toggleProducts.setAttribute("aria-expanded", String(!productsAreHidden));
});

/* Move directly to the chat area when the button is clicked */
goToChat.addEventListener("click", () => {
  chatbox.classList.add("chat-active");
  chatbox.scrollIntoView({ behavior: "smooth", block: "start" });
});

/* Add or remove a product when its card is clicked */
productsContainer.addEventListener("click", async (e) => {
  /* Details buttons open the dialog instead of selecting the card */
  const detailsButton = e.target.closest("[data-details-id]");
  if (detailsButton) {
    const productId = Number(detailsButton.dataset.detailsId);

    /* Clicking the same button again closes the description */
    if (openDetailsId === productId && productDialog.open) {
      productDialog.close();
      openDetailsId = null;
      return;
    }

    const product = allProducts.find((item) => item.id === productId);

    if (product) {
      dialogTitle.textContent = product.name;
      dialogBrand.textContent = product.brand;
      dialogDescription.textContent = product.description;
      openDetailsId = productId;
      productDialog.show();

      /* Place a small popover above the card that was clicked */
      const cardRect = detailsButton.closest(".product-card").getBoundingClientRect();
      const dialogRect = productDialog.getBoundingClientRect();
      let left = cardRect.left + (cardRect.width - dialogRect.width) / 2;
      left = Math.max(16, Math.min(left, window.innerWidth - dialogRect.width - 16));

      let top = cardRect.top - dialogRect.height - 12;
      if (top < 16) {
        top = cardRect.bottom + 12;
      }

      productDialog.style.left = `${left}px`;
      productDialog.style.top = `${top}px`;
    }
    return;
  }

  const card = e.target.closest(".product-card");
  if (!card) return;

  const productId = Number(card.dataset.productId);
  if (allProducts.length === 0) {
    allProducts = await loadProducts();
  }

  const product = allProducts.find((item) => item.id === productId);
  const isAlreadySelected = selectedProducts.some((item) => item.id === productId);

  if (isAlreadySelected) {
    selectedProducts = selectedProducts.filter((item) => item.id !== productId);
  } else {
    selectedProducts.push(product);
  }

  displayProducts(
    allProducts.filter(
      (item) => item.category === categoryFilter.value
    )
  );
  displaySelectedProducts();
  saveSelectedProducts();
});

/* Close the product description dialog */
closeProductDialog.addEventListener("click", () => {
  productDialog.close();
  openDetailsId = null;
});

/* Reset the active product when Escape or the close button closes the popover */
productDialog.addEventListener("close", () => {
  openDetailsId = null;
});

/* Remove a selected product using its remove button */
selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest("[data-remove-id]");
  if (!removeButton) return;

  const productId = Number(removeButton.dataset.removeId);
  selectedProducts = selectedProducts.filter((item) => item.id !== productId);
  displaySelectedProducts();
  saveSelectedProducts();

  if (categoryFilter.value) {
    displayProducts(
      allProducts.filter((item) => item.category === categoryFilter.value)
    );
  }
});

/* Clear every saved selection at once */
clearSelectedProducts.addEventListener("click", () => {
  selectedProducts = [];
  saveSelectedProducts();
  displaySelectedProducts();

  if (categoryFilter.value) {
    displayProducts(
      allProducts.filter((item) => item.category === categoryFilter.value)
    );
  }
});

/* Send messages to the Cloudflare Worker and display the reply */
async function sendToWorker() {
  const thinkingMessage = addChatMessage("Thinking...", "assistant", [], false);

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages,
        web_search_options: {
          search_context_size: "low",
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Worker request failed with status ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    /* Save the assistant reply for future follow-up questions */
    messages.push({ role: "assistant", content: reply });
    thinkingMessage.remove();
    addChatMessage(reply, "assistant", data.choices[0].message.annotations, false);
    keepQuestionAndResponseInView();
  } catch (error) {
    thinkingMessage.remove();
    addChatMessage("Sorry, I could not connect to the routine advisor.", "assistant", [], false);
    keepQuestionAndResponseInView();
  }
}

/* Add a chat bubble without allowing user text to create HTML elements */
function addChatMessage(content, sender, annotations = [], scrollToBottom = true) {
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${sender}`;

  const textElement = document.createElement("div");
  if (sender === "assistant") {
    addFormattedAssistantText(textElement, content, true);
  } else {
    addClickableLinks(textElement, content);
  }
  messageElement.appendChild(textElement);

  /* Show web-search citation links returned by the API */
  const citationUrls = annotations
    .map((annotation) => annotation.url_citation)
    .filter((citation) => citation && citation.url);

  if (citationUrls.length > 0) {
    const sourcesElement = document.createElement("div");
    sourcesElement.className = "chat-sources";
    sourcesElement.innerHTML = "<strong>Sources</strong>";

    citationUrls.forEach((citation) => {
      const sourceLink = document.createElement("a");
      sourceLink.href = citation.url;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";
      sourceLink.textContent = citation.title || citation.url;
      sourcesElement.appendChild(document.createElement("br"));
      sourcesElement.appendChild(sourceLink);
    });

    messageElement.appendChild(sourcesElement);
  }

  chatWindow.appendChild(messageElement);
  if (scrollToBottom) {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
  return messageElement;
}

/* Turn URLs and Markdown-style links into safe, clickable links */
function addClickableLinks(element, content, useSourceLabel = false) {
  const linkPattern =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/gi;

  let currentPosition = 0;
  const matches = content.matchAll(linkPattern);

  for (const match of matches) {
    if (match.index > currentPosition) {
      element.appendChild(
        document.createTextNode(content.slice(currentPosition, match.index))
      );
    }

    const link = document.createElement("a");
    const markdownText = match[1];
    const markdownUrl = match[2];
    const plainUrl = match[3];
    const url = markdownUrl || plainUrl;

    link.href = url.replace(/[.,!?;:]$/, "");
    link.className = "chat-link";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = markdownText || (useSourceLabel ? "Open source" : url);

    element.appendChild(link);

    const punctuationLength =
      markdownText || !plainUrl ? 0 : url.match(/[.,!?;:]$/)?.[0].length || 0;
    currentPosition =
      match.index +
      match[0].length -
      punctuationLength;
  }

  if (currentPosition < content.length) {
    element.appendChild(document.createTextNode(content.slice(currentPosition)));
  }
}

/* Format assistant replies into clean paragraphs and numbered steps */
function addFormattedAssistantText(element, content, useSourceLabel = false) {
  const cleanedContent = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:p|div|section|h[1-6])\s*>/gi, "\n")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = cleanedContent.split("\n");
  let paragraphLines = [];

  function addParagraph() {
    if (paragraphLines.length === 0) return;

    const paragraph = document.createElement("p");
    addClickableLinks(
      paragraph,
      paragraphLines.join(" ").trim(),
      useSourceLabel
    );
    element.appendChild(paragraph);
    paragraphLines = [];
  }

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      addParagraph();
      return;
    }

    const stepMatch = trimmedLine.match(/^(\d+)[.)]\s*(.+)$/);
    if (stepMatch) {
      addParagraph();

      const step = document.createElement("p");
      step.className = "routine-step";
      const stepNumber = document.createElement("span");
      stepNumber.className = "routine-step-number";
      stepNumber.textContent = stepMatch[1];
      step.appendChild(stepNumber);
      addClickableLinks(step, ` ${stepMatch[2].trim()}`, useSourceLabel);
      element.appendChild(step);
      return;
    }

    if (/^[-–]/.test(trimmedLine)) {
      addParagraph();
      const item = document.createElement("p");
      item.className = "routine-step";
      addClickableLinks(
        item,
        trimmedLine.replace(/^[-–]\s*/, ""),
        useSourceLabel
      );
      element.appendChild(item);
      return;
    }

    if (
      trimmedLine.length <= 60 &&
      (trimmedLine.endsWith(":") ||
        /^[A-Za-z][A-Za-z0-9 &/-]+$/.test(trimmedLine))
    ) {
      addParagraph();
      const heading = document.createElement("p");
      heading.className = "routine-heading";
      addClickableLinks(heading, trimmedLine.replace(/:$/, ""), useSourceLabel);
      element.appendChild(heading);
      return;
    }

    paragraphLines.push(trimmedLine);
  });

  addParagraph();
}

/* Start at the latest question so the answer appears directly below it */
function keepQuestionAndResponseInView() {
  const userMessages = chatWindow.querySelectorAll(".chat-message.user");
  const latestQuestion = userMessages[userMessages.length - 1];

  if (!latestQuestion) return;

  requestAnimationFrame(() => {
    const chatRect = chatWindow.getBoundingClientRect();
    const questionRect = latestQuestion.getBoundingClientRect();
    const distanceFromTop = questionRect.top - chatRect.top;

    chatWindow.scrollTop = Math.max(
      0,
      chatWindow.scrollTop + distanceFromTop
    );
  });
}

/* Generate a personalized routine from the selected products */
generateRoutineButton.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    addChatMessage("Please select at least one product first.", "assistant");
    return;
  }

  /* Send only these selected-product fields to the Cloudflare Worker */
  const selectedProductData = selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  const productJson = JSON.stringify(selectedProductData, null, 2);
  const userMessage =
    "Build a personalized skincare or beauty routine using only these selected products:\n" +
    `\`\`\`json\n${productJson}\n\`\`\`\n` +
    "Explain the recommended order and include simple tips.";

  addChatMessage("Generate a routine for my selected products.", "user");
  messages.push({ role: "user", content: userMessage });

  /* Move the page to the chat so the generated routine is easy to see */
  chatbox.classList.add("chat-active");
  chatbox.scrollIntoView({ behavior: "smooth", block: "start" });

  await sendToWorker();
});

/* Chat form submission handler */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  /* Stop clearly unrelated questions before they reach the worker */
  if (isClearlyOffTopic(userMessage)) {
    const shortQuestion =
      userMessage.length > 90
        ? `${userMessage.slice(0, 87).trim()}...`
        : userMessage;
    const friendlyReply =
      `Thanks for asking about "${shortQuestion}". ` +
      "I’m here to help with L'Oréal products and personalized beauty routines. " +
      "I can’t help with that other topic, but I’d be happy to talk about skincare, makeup, haircare, fragrance, ingredients, or your routine.";

    addChatMessage(userMessage, "user");
    addChatMessage(friendlyReply, "assistant");
    messages.push({ role: "user", content: userMessage });
    messages.push({ role: "assistant", content: friendlyReply });
    keepQuestionAndResponseInView();
    userInput.value = "";
    return;
  }

  /* Show the user's message and add it to the conversation */
  addChatMessage(userMessage, "user");
  messages.push({ role: "user", content: userMessage });
  userInput.value = "";

  await sendToWorker();
});

/* Recognize common subjects that are outside the beauty and routine scope */
function isClearlyOffTopic(userMessage) {
  const friendlyPatterns = [
    /^(hi|hello|hey|good (morning|afternoon|evening))\b/i,
    /\b(my name is|i'm|i am|call me|you can call me)\b/i,
  ];

  if (friendlyPatterns.some((pattern) => pattern.test(userMessage))) {
    return false;
  }

  const beautyPatterns = [
    /\b(l['’]?oréal|loreal|cerave|vichy|lancome|lancôme|maybelline|skincare|skin care|haircare|hair care|makeup|cosmetic|cosmetics|fragrance|perfume|scent|beauty|routine|cleanser|moisturizer|serum|sunscreen|spf|suncare|sun care|retinol|vitamin c|hyaluronic|niacinamide|ingredient|ingredients|acne|wrinkle|wrinkles|dry skin|oily skin|sensitive skin|dark circle|puffy|puffiness|hair|hair color|hair styling|grooming)\b/i,
  ];

  const explicitOffTopicPatterns = [
    /\b(weather|temperature|forecast|climate)\b/i,
    /\b(joke|tell me a joke|funny story)\b/i,
    /\b(politics|political|president|election|government)\b/i,
    /\b(sports|football|basketball|baseball|soccer|nfl|nba)\b/i,
    /\b(code|coding|programming|javascript|python|html|css)\b/i,
    /\b(recipe|recipes|cook|cooking|bake|baking)\b/i,
    /\b(movie|film|music|song|celebrity|actor|actress|book|novel)\b/i,
    /\b(capital|country|geography|history|world war)\b/i,
    /\b(math|mathematics|calculate|calculus|equation)\b/i,
    /\b(stock|stocks|bitcoin|crypto|cryptocurrency|investing)\b/i,
    /\b(gaming|video game|playstation|xbox|nintendo)\b/i,
    /\b(travel|flight|flights|hotel|vacation)\b/i,
  ];

  if (explicitOffTopicPatterns.some((pattern) => pattern.test(userMessage))) {
    return true;
  }

  if (beautyPatterns.some((pattern) => pattern.test(userMessage))) {
    return false;
  }

  /* If a routine has already been generated, allow short conversation follow-ups */
  const hasRoutineConversation = messages.some(
    (message) => message.role === "assistant"
  );
  const shortFollowUpPatterns = [
    /^(what|why|how|which|when|where|can|could|should|does|do|is|are)\b/i,
  ];

  if (
    hasRoutineConversation &&
    shortFollowUpPatterns.some((pattern) => pattern.test(userMessage))
  ) {
    return false;
  }

  /* Any unrelated question not covered above should not reach the worker */
  return true;
}

/* Restore saved selections when the page loads */
restoreSelectedProducts();
